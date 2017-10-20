/*!
* Author: Antonio Dal Sie
* Name: ContentfulScout
* Description: Extract data from Contenful API
*/
const PrismicDOM = require("prismic-dom");
const Circular = require('circular-json');

class ContentfulScout {

  constructor(client = null, options = {}){
    this.client = client;
    this.availableTypes = ["text","html","default","document"];
    this.options = options;
  }

  /**
   * Retrive some/all fields from prismis results array
   */
  retriveFromData(data, fields = {}, options = {}){
    options = Object.assign({}, this.options, options);

    return new Promise( (resolve) => {
      let _data = data.map( d => this._clean(d, options));
      // if(Object.keys(fields).length == 0) return resolve(_data);

      Promise.all(_data.map( d => this._extract(d, fields, options)
        .then( exData => exData)))
        .then(_data => {
          resolve(_data);
        }).catch(() => console.error("Error fetching data"));
    });
  }

  /**
   * Retrive some/all fields from prismis document
   */
  retriveSingle(doc, fields = {}, options = {}){
    options = Object.assign({}, this.options, options);
    
    return new Promise( (resolve) => {
      if(typeof doc === "undefined"){
        resolve();
      }else if(doc.constructor === Array){
        console.warn("Data is array, you can use 'retriveFromData' instead");
        return this.retriveFromData(doc, fields).then( arrayData => {
          resolve(arrayData);
        }).catch(() => console.error("Error fetching data"));
      }else{
        let _data = this._clean(doc, options);
        if(Object.keys(fields).length == 0) return resolve(_data);

        this._extract(_data, fields, options).then( exData => resolve(exData))
          .catch(() => console.error("Error fetching single data"));
      }
    });
  }

  /**
   * Extract some/all fields from Scout extract array object
   */
  extractFromData(data, fields = {}, options = {}){
    options = Object.assign({}, this.options, options);

    return new Promise( (resolve) => {
      if(Object.keys(fields).length == 0) return resolve(data);

      Promise.all(data.map( d => this._extract(d, fields, options)
        .then( exData => exData)))
        .then(data => {
          resolve(data);
        })
        .catch(() => console.error("Error extract data"));
    });
  }

  /**
   * Extract some/all fields from Scout extract object
   */
  extractSingle(doc, fields = {}, options = {}){
    options = Object.assign({}, this.options, options);
    
    return new Promise( (resolve) => {
      if(typeof doc === "undefined"){
        resolve();
      }else if(doc.constructor === Array){
        console.warn("Data is array, you can use 'extractFromData' instead");
        return this.extractFromData(doc, fields).then( arrayData => {
          resolve(arrayData);
        })
          .catch(() => console.error("Error extract data"));
      }else{
        if(Object.keys(fields).length == 0) return resolve(doc);

        this._extract(doc, fields, options).then( exData => resolve(exData))
          .catch(() => console.error("Error extract single"));
      }
    });
  }

  _setIfOptions(data, baseData, options){
    if(options.id !== false) data["id"] = baseData.id || baseData.sys.id;
    if(options.lang !== false) data["locale"] = baseData.locale || baseData.sys.locale;
    if(options.blocktype === true) data["blocktype"] = baseData.blocktype || baseData.sys.contentType.sys.id;

    return data;
  }

  _clean(data, options){
    let cleanData = data;

    if(options.clear !== false)
      cleanData = cleanData.fields;

    cleanData = this._setIfOptions(cleanData, data, options);

    return cleanData;
  }

  _cleanAsset(data, options){
    let cleanData = data;
    cleanData = cleanData.fields;
    data["locale"] = data.locale || data.sys.locale;

    return cleanData;
  }

  _extract(data, fields, options, asset = false){
    let onlyData = {};
    let extractData = {};
    if(asset == false)
      extractData = this._setIfOptions(extractData, data, options);

    Object.keys(data).forEach(d => {
      if(fields.hasOwnProperty(d)){
        onlyData[d] = data[d]; 
      }
    });

    let promises = Object.keys(onlyData)
      .map( fieldKey => this._extracByType(fieldKey, onlyData[fieldKey], fields[fieldKey], extractData, options, asset));

    return Promise.all(promises).then(() => {
      return extractData;
    })
      .catch((e) => console.error(e,"Error during the extraction"));
  }

  _extracByType(fieldKey, value, fieldChild = {}, extractData, options, asset){
    return new Promise((resolve) => {
      const hasType = fieldChild.hasOwnProperty("_type");
      let hasDeepLevel = Object.keys(fieldChild).length > 0;

      if(hasType){
        this._customType(value, fieldChild, options).then(customTypeExtract => {
          extractData[fieldKey] = customTypeExtract;
          resolve();
        }).catch(() => console.error("Error extracting type"));

      }else if(Array.isArray(value) && hasDeepLevel){
        let newItem = [];
        let promises = [];

        for(let index in value){
          let item = value[index];

          if(fieldChild._types === true){
            let itemValue = this._clean(item, options);
            let clearFieldChild = Object.assign({}, fieldChild);
            delete clearFieldChild["_types"];
            let hasDeepLevel = Object.keys(clearFieldChild).length > 0;

            // console.log(JSON.stringify(itemKey));

            // if(itemValue.link_type === "Document"){
            //   promises.push(new Promise((resolve) => {
            //     this._getSubDocument(itemValue.id, clearFieldChild[itemValue.type], options).then(subDocument => {
            //       resolve({ [itemValue.type]: subDocument });
            //     }).catch(() => console.error("Error extract document in array"));
            //   }));

            // }else if(itemValue && hasDeepLevel){
            if(itemValue && hasDeepLevel){
              promises.push(new Promise((resolve) => {
                this._extract(itemValue, clearFieldChild[itemValue.blocktype], options).then( extractValue => {
                  resolve(extractValue);
                }).catch(() => console.error("Error extract sub value in array"));
              }));

            }else{
              newItem.push(itemValue);
            }

          }else{
            promises.push(this._multipleGroup(item, fieldChild, options));
          }
          
        }

        Promise.all(promises).then((resolveArray) => {
          newItem.push(...resolveArray);
          extractData[fieldKey] = newItem;
          resolve();
        }).catch((e) => console.error(e,"Error during types extraction"));

      }else if(value && value.hasOwnProperty("sys") && value.sys.type === "Asset"){
        value = this._cleanAsset(value);
        this._extract(value, fieldChild, options, true).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        }).catch(() => console.error("Error extract asset"));

      }else if(value && value.hasOwnProperty("sys")){
        this._getSubDocument(value, fieldChild, options, asset).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        }).catch(() => console.error("Error extract document"));

      }else if(value && hasDeepLevel){
        this._extract(value, fieldChild, options, asset).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        }).catch(() => console.error("Error extract sub value"));

      }else{
        extractData[fieldKey] = value;
        resolve();
      }
    });
  }

  _customType(value, field, options){
    return new Promise((resolve) => {
      if(field._type === "document"){
        let cleanField = Object.assign({}, field);
        delete cleanField["_type"];
        this._getSubDocument(value, cleanField, options).then( documentVal => {
          resolve(documentVal);
        }).catch(() => console.error("Error extract document"));
      }else if(field._type === "default"){
        resolve(value);

      }else{
        resolve(value);
      }
    });
  }

  _multipleGroup(item, fieldChild, options){
    return new Promise( (resolve) => {
      const childObject = {};
      const childPromises = [];

      Object.keys(item).forEach( itemChildKey => {
        let itemFieldChild = fieldChild[itemChildKey];
        let itemChildValue = item[itemChildKey];
        if(typeof itemFieldChild === "undefined") return;

        let hasType = itemFieldChild.hasOwnProperty("_type");
        let hasDeepLevel = Object.keys(itemFieldChild).length > 0;

        if(hasType){
          childPromises.push(new Promise( (resolve) => {
            this._customType(itemChildValue, itemFieldChild, options).then( itemExtract => {
              resolve({ [itemChildKey]: itemExtract });
            }).catch(() => console.error("Error extracting type"));
          }));
        }else if(itemChildValue.link_type === "Document"){
          childPromises.push(new Promise( (resolve) => {
            this._getSubDocument(itemChildValue, itemFieldChild, options).then( itemDocument => {
              resolve({ [itemChildKey]: itemDocument });
            }).catch(() => console.error("Error extract document"));
          }));

        }else if(Array.isArray(itemChildValue) && hasDeepLevel){
          childPromises.push(new Promise( (resolve) => {
            let internalPromise = [];
            
            itemChildValue.forEach(_value => {
              internalPromise.push(new Promise( (resolve) => {
                this._extract(_value, itemFieldChild, options).then( itemExtract => {
                  resolve(itemExtract);
                }).catch(() => console.error("Error extract sub value in array"));
              }));
            });

            Promise.all(internalPromise).then( resolveInternalPromise => {
              resolve({ [itemChildKey]: resolveInternalPromise });
            }).catch(() => console.error("Error during extraction in array"));
          }));

        }else if(itemChildValue && hasDeepLevel){
          childPromises.push(new Promise( (resolve) => {
            this._extract(itemChildValue, itemFieldChild, options).then( itemExtract => {
              resolve({ [itemChildKey]: itemExtract });
            }).catch(() => console.error("Error extract sub value"));
          }));

        }else{
          childObject[itemChildKey] = itemChildValue;
        }
      });

      Promise.all(childPromises).then( resolveChildObject => {
        Object.assign(childObject, ...resolveChildObject);
        resolve(childObject);
      }).catch(() => console.error("Error during multiple extraction"));
    });
  }

  _getSubDocument(doc, fields, options){
    return new Promise( resolve => {
      doc = this._clean(doc, options);

      if(Object.keys(fields).length == 0){
        return resolve(doc);
      }

      this._extract(doc, fields, options).then( onlyFiels => {
        resolve(onlyFiels);
      });

    }).catch((e) => console.error(e, "Error during subdocument fetch"));
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = ContentfulScout;