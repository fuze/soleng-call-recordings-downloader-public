'use strict'

const { defaultPageSize } = require('./RecordingClient');
const moment = require('moment');
const { whilst } = require('async')

exports.CallRecordingsDownloader = class CallRecordingsDownloader {
  constructor(client, logger, pageDownloader){
    if(!client) throw new Error('No client to use')
    if(!logger) throw new Error('No logging feature defined')
    if(!pageDownloader) throw new Error('No pageDownloader defined')
                
    this._logger = logger
    this._client = client
    this._pageDownloader = pageDownloader
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _numberOfPages(results, pageSize) {
    if (!results || !results.list || !results.list.total) {
      this._logger.info('No call recordings to download.');
      return 0;
    }
        
    try {
      this._logger.info(`total: ${results.list.total}`)
      let division = results.list.total/pageSize
      return (results.list.total % pageSize) > 0 ? Math.floor(division) + 1 : division
    } catch(err) {
      throw err
    }
  }
  
  wait(timeToDelay) {
    new Promise((resolve) => {
      setTimeout(resolve, timeToDelay)
    })
  }

  async download(startDate, endDate, startTime, endTime) {
    this._logger.info(`Downloading call recordings between ${startDate} ${startTime} (UTC) and  ${endDate} ${endTime} (UTC)`)
    
    let numberOfPages = 0;
    let all = [];

    try {
      let needRecordingsList = true;
      let retryCount = 0;
      whilst(
        (testCallback) => {
          testCallback(null, needRecordingsList)
        },
        async (iterCallback) => {
          let list = await this._client.getSecuredRecordingsList(startDate, endDate, startTime, endTime);

          if(list.statusCode === 429 || list.statusCode === "429" || list.statusCode == 429) {
            //...
            this._logger.info(`recieved 429. wait 30 seconds and retry ${++retryCount}`)
            await this.sleep(30000)
          } else {
            needRecordingsList = false;
            numberOfPages = this._numberOfPages(list, defaultPageSize);
            
            for( let page = 0; page < numberOfPages; page++ ) {
              this._logger.info(`Processing page ${page + 1}/${numberOfPages}`);
              const results = await this._pageDownloader.download(startDate, endDate, startTime, endTime, page);
            }
            iterCallback(all.concat(results))
          }
        },
        (err, all) => {
          return all
        }
      )
    } catch(err) {
      this._logger.info(`caught error: ${err}`)
      throw err
    }
  }

  downloadRecordingsSinceTheBegginingOfLastDay() {
    const now = moment();
    const startDate = now.utc();
    const endDate = startDate.clone();
    const startTime = '00:00:00';
    const endTime = '23:59:59';
    startDate.add(-1, 'days');

    return this.download(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), startTime, endTime);
  }

  downloadRecordingsBetweenTwoDatesTimes(startDate, endDate, startTime, endTime) {
    const start = moment(startDate).utc();
    const end = moment(endDate).utc();

    return this.download(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), startTime, endTime);
  }
}