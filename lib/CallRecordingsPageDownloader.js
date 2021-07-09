'use strict'
const moment = require('moment')

exports.CallRecordingsPageDownloader = class CallRecordingsPageDownloader {
  constructor(logger, client, save, processedResultStore) {
    this._logger = logger;
    this._client = client;
    this._save = save;
    this._processedResultsStore = processedResultStore;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _downloadRecording(methods, result) {
    let existsAudioFile = await methods._save.checkExistsAudioFile(result.id);
    let existsMetadataFile = await methods._save.checkExistsMetadataFile(result.id);
    let success;

    try {
      if (existsAudioFile) {
        this._logger.info(`Skipping download of Record ID #${result.id}: already exists!`);
  
        if (!existsMetadataFile) await methods._save.saveMetadataFile(result);
      } else {
        let link = await methods._client.getSecuredRecordingMediaLink(result.id);
        let recording = await methods._client.secureDownloadRecording(link);
  
        if (existsMetadataFile) await methods._save.deleteMetadataFile(result.id);
        await methods._save.save(result, recording);
  
        this._logger.info(`Record ID #${result.id} downloaded`);
      }

      success = true;
    } catch (e) {
      this._logger.error(`Record ID #${result.id} not downloaded due to ${e}`);

      success = false;
    }

    return success;
  }

  async download(startDate, endDate, startTime, endTime, page) { 
    let results = [];
    let promises = [];
    
    const times = {}
    times.startDate = moment(startDate).format()
    times.endDate = moment(endDate).format()
    try {
      let needRecordingList = true;
      let recordingList = {};
      let retryCount = 0;
      while(needRecordingList) {
        recordingList = await this._client.getSecuredRecordingsList(startDate, endDate, startTime, endTime, page);

        if(recordingList.statusCode === 429 || recordingList.statusCode == 429 || recordingList.statusCode == "429")  {
          this._logger.info(`recieved a 429 statusCode. wait 30 seconds and retry ${++retryCount}`);
          needRecordingList = true
          await this.sleep(30000)
        } else {
          needRecordingList = false

          for (let r = 0; r < recordingList.list.pageResults.length ; r++) {
            let result = recordingList.list.pageResults[r];
            
            if(result.destination && result.destination.length > 0 && result.destination[0] === '*') {
                continue;
            } else {
              let methods = {};
              methods._save = this._save;
              methods._logger = this._logger; 
              methods._client = this._client;
              
              // this._logger.info(`Downloading Record ID #${result.id}`);

              promises.push(this._downloadRecording(methods, result)); 
            } 
          }

          results = await Promise.all(promises);
        }
      }
    } catch(err) {
        this._logger.error(`Error saving page ${page} ${err}`);
    }

    return results;
  }
}