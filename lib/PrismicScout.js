/**
 * PrismicScout class
 *
 * Todo:
 * -In Array check if different fileds type
 */
const PrismicDOM = require("prismic-dom");

class PrismicScout {

  constructor(api){
    this.api = api;
  }

  retriveFromData(data, fields = {}){
    return new Promise( (resolve) => {
      let _data = data.map( d => this._clean(d));

      if(Object.keys(fields).length == 0) return resolve(_data);

      Promise.all(_data.map( d => this._extract(d, fields)
        .then( exData => exData)))
        .then(_data => {
          resolve(_data);
        });
    });
  }

  _clean(data){
    let cleanData = data.data;
    cleanData["id"] = data.id;
    cleanData["uid"] = data.uid;
    cleanData["lang"] = data.lang;

    return cleanData;
  }

  _extract(data, fields){

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
      .map( fieldKey => this._promiseEntry(fieldKey, onlyData[fieldKey], fields[fieldKey], extractData));

    return Promise.all(promises).then(() => {
      return extractData;
    });
  }

  _promiseEntry(fieldKey, value, filedChilds, extractData){
    return new Promise((resolve) => {
      const hasType = filedChilds.hasOwnProperty("_type");
      const hasDeepLevel = Object.keys(filedChilds).length > 0;

      if(hasType && filedChilds._type === "text"){
        extractData[fieldKey] = PrismicDOM.RichText.asText(value);
        resolve();

      }else if(hasType && filedChilds._type === "richtext"){
        extractData[fieldKey] = PrismicDOM.RichText.asHtml(value, () => { return "/" });
        resolve();

      }else if(Array.isArray(value)){
        let newItem = [];
        let promises = [];

        for(let index in value){
          let item = value[index];
          let itemValue = item[Object.keys(item)[0]];
          if(itemValue.hasOwnProperty("link_type") && itemValue.link_type === "Document"){

            promises.push(this._getSubDocument(itemValue.id, filedChilds));
          }else if(typeof itemValue === "object" && hasDeepLevel){
            promises.push(this._extract(itemValue, filedChilds));
          }else{
            newItem.push(itemValue);
          }
          
        }

        Promise.all(promises).then((resolveArray) => {
          newItem.push(...resolveArray);
          extractData[fieldKey] = newItem;
          resolve();
        });

      }else if(typeof value === "object" && hasDeepLevel){
        this._extract(value, filedChilds).then((_value) => {
          extractData[fieldKey] = _value;
          resolve();
        });
      }else{
        extractData[fieldKey] = value;
        resolve();
      }
    });
  }

  _getSubDocument(id, fields){
    return new Promise( resolve => {
      this.api.getByID(id).then((doc) => {
        doc = this._clean(doc);

        if(Object.keys(fields).length == 0){
          return resolve(doc);
        }

        this._extract(doc, fields).then( onlyFiels => {
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