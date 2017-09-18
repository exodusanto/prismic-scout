/**
 * PrismicScout class
 */
const PrismicDOM = require("prismic-dom");

class PrismicScout {

  constructor(api, options = {}){
    this.api = api;
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

      if(Object.keys(fields).length == 0) return resolve(_data);

      Promise.all(_data.map( d => this._extract(d, fields, options)
        .then( exData => exData)))
        .then(_data => {
          resolve(_data);
        });
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
        });
      }else{
        let _data = this._clean(doc, options);
        if(Object.keys(fields).length == 0) return resolve(_data);

        this._extract(_data, fields, options).then( exData => resolve(exData));
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
        });
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
        });
      }else{
        if(Object.keys(fields).length == 0) return resolve(doc);

        this._extract(doc, fields, options).then( exData => resolve(exData));
      }
    });
  }

  _clean(data, options){
    let cleanData = data;

    if(options.clear !== false)
      cleanData = cleanData.data;

    if(options.id !== false)
      cleanData["id"] = data.id;
    
    if(options.uid !== false)
      cleanData["uid"] = data.uid;

    if(options.lang !== false)
      cleanData["lang"] = data.lang;

    if(options.blocktype === true)
      cleanData["blocktype"] = data.type;

    return cleanData;
  }

  _extract(data, fields, options){

    let onlyData = {};
    let extractData = {};
    extractData["id"] = data.id;
    extractData["uid"] = data.uid;
    extractData["lang"] = data.lang;
    if(options.blocktype === true) extractData["blocktype"] = data.blocktype;

    Object.keys(data).forEach(d => {
      if(fields.hasOwnProperty(d)){
        onlyData[d] = data[d]; 
      }
    });

    let promises = Object.keys(onlyData)
      .map( fieldKey => this._extracByType(fieldKey, onlyData[fieldKey], fields[fieldKey], extractData, options));

    return Promise.all(promises).then(() => {
      return extractData;
    });
  }

  _extracByType(fieldKey, value, fieldChild = {}, extractData, options){
    return new Promise((resolve) => {
      const hasType = fieldChild.hasOwnProperty("_type");
      let hasDeepLevel = Object.keys(fieldChild).length > 0;

      if(hasType){
        this._customType(value, fieldChild, options).then(customTypeExtract => {
          extractData[fieldKey] = customTypeExtract;
          resolve();
        });

      }else if(Array.isArray(value) && hasDeepLevel){
        let newItem = [];
        let promises = [];

        for(let index in value){
          let item = value[index];

          if(fieldChild._single === true){
            let itemKey = Object.keys(item)[0];
            let itemValue = item[itemKey];
            let clearFieldChild = Object.assign({}, fieldChild);
            delete clearFieldChild["_single"];

            if(itemValue.link_type === "Document"){
              promises.push(this._getSubDocument(itemValue.id, clearFieldChild, options));

            }else if(itemValue && hasDeepLevel){
              promises.push(this._extract(itemValue, clearFieldChild, options));

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
        });

      }else if(value && hasDeepLevel){
        this._extract(value, fieldChild, options).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        });

      }else if(value && value.link_type === "Document"){
        this._getSubDocument(value.id, fieldChild, options).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        });

      }else{
        extractData[fieldKey] = value;
        resolve();
      }
    });
  }

  _customType(value, field, options){
    return new Promise((resolve) => {
      if(field._type === "text"){
        resolve(PrismicDOM.RichText.asText(value));

      }else if(field._type === "html"){
        resolve(PrismicDOM.RichText.asHtml(value, () => { return "/" }));

      }else if(field._type === "document"){
        let cleanField = Object.assign({}, field);
        delete cleanField["_type"];
        this._getSubDocument(value.id, cleanField, options).then( documentVal => {
          resolve(documentVal);
        });
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
            });
          }));
        }else if(itemChildValue.link_type === "Document"){
          childPromises.push(new Promise( (resolve) => {
            this._getSubDocument(itemChildValue.id, itemFieldChild, options).then( itemDocument => {
              resolve({ [itemChildKey]: itemDocument });
            });
          }));

        }else if(Array.isArray(itemChildValue) && hasDeepLevel){
          childPromises.push(new Promise( (resolve) => {
            let internalPromise = [];
            
            itemChildValue.forEach(_value => {
              internalPromise.push(new Promise( (resolve) => {
                this._extract(_value, itemFieldChild, options).then( itemExtract => {
                  resolve(itemExtract);
                });
              }));
            });

            Promise.all(internalPromise).then( resolveInternalPromise => {
              resolve({ [itemChildKey]: resolveInternalPromise });
            });
          }));

        }else if(itemChildValue && hasDeepLevel){
          childPromises.push(new Promise( (resolve) => {
            this._extract(itemChildValue, itemFieldChild, options).then( itemExtract => {
              resolve({ [itemChildKey]: itemExtract });
            });
          }));

        }else{
          childObject[itemChildKey] = itemChildValue;
        }
      });

      Promise.all(childPromises).then( resolveChildObject => {
        Object.assign(childObject, ...resolveChildObject);
        resolve(childObject);
      });
    });
  }

  _getSubDocument(id, fields, options){
    return new Promise( resolve => {
      this.api.getByID(id).then((doc) => {
        doc = this._clean(doc, options);

        if(Object.keys(fields).length == 0){
          return resolve(doc);
        }

        this._extract(doc, fields, options).then( onlyFiels => {
          resolve(onlyFiels);
        });
      });
    });
  }
}

/**
 * Exports
 * @type {Class}
 */
module.exports = PrismicScout;