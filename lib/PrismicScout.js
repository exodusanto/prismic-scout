/**
 * PrismicScout class
 *
 * Todo:
 * -In Array check if different fields type
 */
const PrismicDOM = require("prismic-dom");

class PrismicScout {

  constructor(api){
    this.api = api;
    this.availableTypes = ["text","html","Document"];
  }

  retriveFromData(data, fields = {}, options = {}){
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

  retriveSingle(data, fields = {}, options){
    return new Promise( (resolve) => {
      if(typeof data === "undefined"){
        resolve();
      }else if(data.constructor === Array){
        console.warn("Data is array, you can use 'retriveFromData' instead");
        return this.retriveFromData(data, fields).then( arrayData => {
          resolve(arrayData);
        });
      }else{
        let _data = this._clean(data, options);
        if(Object.keys(fields).length == 0) return resolve(_data);

        this._extract(_data, fields, options).then( exData => resolve(exData));
      }
    });
  }

  _clean(data, options){
    let cleanData = data;

    if(!options.hasOwnProperty("clear") || options.clear === false)
      cleanData = cleanData.data;

    if(!options.hasOwnProperty("id") || options.id !== false)
      cleanData["id"] = data.id;
    
    if(!options.hasOwnProperty("uid") || options.uid !== false)
      cleanData["uid"] = data.uid;

    if(!options.hasOwnProperty("lang") || options.lang !== false)
      cleanData["lang"] = data.lang;

    return cleanData;
  }

  _extract(data, fields, options){

    let onlyData = {};
    let extractData = {};
    extractData["id"] = data.id;
    extractData["uid"] = data.uid;
    extractData["lang"] = data.lang;

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
      const hasDeepLevel = Object.keys(fieldChild).length > 0;

      if(hasType){
        this._customType(value, fieldChild, options).then(customTypeExtract => {
          extractData[fieldKey] = customTypeExtract;
          resolve();
        });

      }else if(Array.isArray(value)){
        let newItem = [];
        let promises = [];

        for(let index in value){
          let item = value[index];
          if(Object.keys(item).length > 1){
            promises.push(this._multipleGroup(item, fieldChild, options));

          }else{
            let itemKey = Object.keys(item)[0];
            let itemValue = item[itemKey];

            if(itemValue.hasOwnProperty("link_type") && itemValue.link_type === "Document"){
              promises.push(this._getSubDocument(itemValue.id, fieldChild, options));

            }else if(typeof itemValue === "object" && hasDeepLevel){
              promises.push(this._extract(itemValue, fieldChild, options));

            }else{
              newItem.push(itemValue);
            }
          }
          
        }

        Promise.all(promises).then((resolveArray) => {
          newItem.push(...resolveArray);
          extractData[fieldKey] = newItem;
          resolve();
        });

      }else if(typeof value === "object" && hasDeepLevel){
        this._extract(value, fieldChild, options).then((_value) => {
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
      }else{
        resolve(value);
      }
    });
  }

  _multipleGroup(item, fieldChild, options){
    return new Promise( (resolve) => {
      const childArray = [];
      const childPromises = [];

      Object.keys(item).forEach( itemChildKey => {
        let itemFieldChild = fieldChild[itemChildKey];
        if(typeof itemFieldChild === "undefined") return;

        let itemChildValue = item[itemChildKey];
        let hasType = itemFieldChild.hasOwnProperty("_type");

        if(hasType){
          childPromises.push(new Promise( (resolve) => {
            this._customType(itemChildValue, itemFieldChild, options).then( itemExtract => {
              resolve({ [itemChildKey]: itemExtract });
            });
          }));
        }else if(itemChildValue.hasOwnProperty("link_type") && itemChildValue.link_type === "Document"){
          childPromises.push(new Promise( (resolve) => {
            this._getSubDocument(itemChildValue.id, itemFieldChild, options).then( itemDocument => {
              resolve({ [itemChildKey]: itemDocument });
            });
          }));

        }else if(typeof itemFieldChild === "object" && Object.keys(itemFieldChild).length > 0){
          childPromises.push(new Promise( (resolve) => {
            this._extract(itemChildValue, itemFieldChild, options).then( itemExtract => {
              resolve({ [itemChildKey]: itemExtract });
            });
          }));

        }else{
          childArray.push({ [itemChildKey]: itemChildValue });
        }
      });

      Promise.all(childPromises).then( resolveChildArray => {
        childArray.push(...resolveChildArray);
        resolve(childArray);
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