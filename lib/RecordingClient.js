'use strict'

const { URL } = require('url')
const https = require('https')
const defaultPage = 0
const defaultPageSize = 999

class AbstractRecordingsClient {
  constructor(host, token, logger) {
    if(!host) throw new Error('Invalid host token');
    
    this._host = host;
    this._token = token;
    this._logger = logger;
  }

  get host() {
    return this._host;
  }

  set host(newHost) {
    this._host = newHost;
  }

  get token() {
    return this._token;
  }

  set token(newToken) {
    this._token = newToken;
  }

  get logger() {
    return this._logger;
  }
}

class RestRecordingsClient extends AbstractRecordingsClient{
  constructor(host, token, basePath, logger) {
    super(host, token, logger);
    this._basePath = basePath;
  }

  get basePath() {
    return this._basePath;
  }

  set basePath(newBasePath) {
    this._basePath = newBasePath;
  }
  
  getSecuredRecordingsList(startDate, endDate, startTime, endTime, page=defaultPage, pageSize=defaultPageSize) {
    let options = this.getRecordingListOptions(startDate, endDate, startTime, endTime, page, pageSize);
    return this.getRecordingsList(options, https);
  }
  
  getRecordingsList (options, transport) {
    return new Promise((resolve, reject) => {
      this._logger.debug('Querying recordings list...');
      this._logger.debug('Request Options: ' + JSON.stringify(options));
      console.log('Querying recordings list...');
      console.log('Request Options: ' + JSON.stringify(options));
      
      let request = transport.request(options, (res) => {

        if (res.statusCode === 429) {
          resolve({"statusCode": 429})
        } else if (res.statusCode >= 400) {
          reject(new Error(`Request to ${options.host}${options.path} failed with code ${res.statusCode} - ${res.statusMessage}`));
        } else {
          let recList = new RecordingsList();
          let response = ''

          res.on('data', (data) => {
            response += data;
          });
          
          res.on('end', () => {
            try {
              recList.list = JSON.parse(response);
              recList.statusCode = res.statusCode; // added by mmcgee so that it's always there.
              resolve(recList);
            } catch (e) {
              this._logger.error('Failed to parse response ' + response + ' error: ' + e);
  
              reject(new Error('No data from the API?'));
            }
          });
          
          res.on('error', (err) => {
            this._logger.error('Error: ' + err);
  
            reject(err);
          });
        }
      });
      
      request.end();
      
      request.on('error', (err) => {
        this._logger.error('Failed request: ' + err);
        reject(err);
      }); 
    });
  }
  
  getSecuredRecordingMediaLink(id) {
    let options = this.getMediaLinkOptions(id);
    return this.getRecordingMediaLink(options, https, id);
  }

  getRecordingMediaLink (options, transport) {
    this._logger.debug(`getRecordingMediaLink: ${options}`)
    return new Promise((resolve, reject) => { 
      let request = transport.request(options, (res) => {
        let location = getHeaderParameter(res.headers, 'Location')

        if ( res.statusCode > 300 && res.statusCode < 400 && location) {
          resolve(location);
        } else {
          reject(new Error('No recording link on redirect location attribute of the response'));
        }
      });
      
      request.end();
      
      request.on('error', (err) => {
        console.log('rejected...')
        console.log(err)
        reject(err);
      });
    });
  }
  
  secureDownloadRecording (recordingLink) {
    return new Promise((resolve, reject) => {
      if (!recordingLink) {
        reject('To get the recording a recording link is needed');
      } else {
        this.download(recordingLink, https, resolve, reject);
      }
    });
  }
  
  getRecordingListOptions(startDate, endDate, startTime, endTime, page=defaultPage, pageSize=defaultPageSize){
    if (!(isValidDate(startDate) && isValidDate(endDate) && isValidTime(startTime) && isValidTime(endTime) && Number.isInteger(page) && page >= 0 && Number.isInteger(pageSize) && pageSize > 0)) {
      throw new Error('Invalid start/end dates/time');
    }   
    
    let path = this._basePath + 'recordings?dateStart=' + startDate + '&dateEnd=' + endDate + '&timeStart=' + startTime + '&timeEnd=' + endTime + '&page=' + page + '&pageSize=' + pageSize;
    return options(this._host, path, this._token);
  }
  
  getMediaLinkOptions (id)  {
    if (!id) {
      throw new Error('Invalid Media ID');
    }
    
    let path = this._basePath + 'media/' + id;
    return options(this._host, path, this._token);
  }
  
  download (link, transport, resolve, reject) {  
    try {
      const myUrl = new URL(link);
      
      let request = transport.request(myUrl, (res) => {
        // console.log(res.statusCode)
        if(res.statusCode && res.statusCode === 429)
          setTimeout( () => { resolve(this.download(link, transport, resolve, reject)) }, 1000)
        else
          resolve(res);
      }).on(('error'), (err) => {
        console.log(`error: ${err}`)
        reject(err);
      });
      
      request.end();
    } catch (err) {
      console.log(`caught error: ${err}`)
      reject(err);
    }
  }
}

const isValidDate = (date) => {
  if (!date) {
    throw new Error('No date to validate');
  }
  
  let matches = /(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return matches ? true : false;
}

const isValidTime = (time) => {
  if (!time) {
    throw new Error('No time to validate');
  }
  
  let matches = /(\d{2}):(\d{2}):(\d{2})/.exec(time);
  return matches ? true : false;
}

const getHeaderParameter = (headers, attribute) => {
  let value;

  if (headers[attribute]) {
    value = headers[attribute].length > 0 ? headers[attribute] : undefined;
  } else if(headers[attribute.toLowerCase()]) {
    value = headers[attribute.toLowerCase()].length > 0 ? headers[attribute.toLowerCase()] : undefined;
  } else if(headers[attribute.toUpperCase()]) {
    value = headers[attribute.toUpperCase()].length > 0 ? headers[attribute.toUpperCase()] : undefined;
  }

  return value;
}

class RecordingsList {
  get list() {
    return this._list;
  }
  
  set list(list) {
    this._list = list;
  }
}

const options = (host, path, token ) => {
  return {
    host: host,
    path: path,
    headers: {
      'cookie' : 'WARDEN_SSO_AUTHORIZATION=' + token,
      'content-type' : 'text/plain; charset=utf-8',
      'accept' : '*/*'
    }
  }
}

module.exports = {
  AbstractRecordingsClient : AbstractRecordingsClient,
  RestRecordingsClient : RestRecordingsClient,
  RecordingsList : RecordingsList,
  defaultPage : defaultPage,
  defaultPageSize : defaultPageSize
}