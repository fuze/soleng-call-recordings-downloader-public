'use strict'

const fs = require('fs')
const path = require('path')

exports.CallRecordingFileWriter = class CallRecordingFileWriter {
    constructor(outputFolder) {
        this._outputFolder = outputFolder
    }

    async save(result, recording){
        if(!result || !recording) throw new Error('No result or recording stream to save')

        try {
            let recordingPath = await this._saveToDisk(recording, result.id)
            let metadataPath = await this.saveMetadataFile(result)
        } catch(e) {
            throw new Error(`Failed to save the recordings to ${this._outputFolder}: ${e}`)
        }

        return true
    }

    _saveToDisk (stream, id) {
        return new Promise((resolve, reject) => {
            
            let audioFile = id + '.wav'
            let audioFilePath = path.join(this._outputFolder, audioFile)
            
            fs.open(audioFilePath, 'wx', (err, fd) => {
                if (err) {
                    if (err.code === 'EEXIST') {
                        console.error(`File ${audioFilePath} already exists`);

                    }
                    reject(err)
                } else {
                    const outFileStream = fs.createWriteStream(audioFilePath, { fd });

                    outFileStream.on('finish', () => {
                      console.debug('Finished writing to file.');
                      resolve(audioFilePath);
                    });

                    outFileStream.on('error', (err) => {
                      console.error(err);
                      reject(new Error(`Failed to write to file ${audioFilePath}, error: ${err}`));
                    });

                    stream.pipe(outFileStream);
                }
            })
        })
    }

    _getDirection(direction) {
      if (direction === 0) return 'inbound';
      if (direction === 1) return 'outbound';
      return direction;
    }

    saveMetadataFile (result) {
        return new Promise((resolve, reject) => {
            
            let metadataFile = result.id + '.json'
            let metadataFilePath = path.join(this._outputFolder, metadataFile)
            
            fs.exists(metadataFilePath, (exist) => {
                if(exist) {
                    reject(new Error(`File ${metadataFilePath} already exists`))
                } else {
                    let toBeSaved = this.truncateRecordings(result)
                    
                    fs.writeFile(metadataFilePath, JSON.stringify(toBeSaved), 'utf8', (err) => {
                        if(err) {
                            reject(err)
                        }else {
                            resolve(metadataFilePath)
                        }
                    })
                    
                }
            })
        })
    }

    deleteMetadataFile (result) {
        return new Promise((resolve, reject) => {
            
            let metadataFile = result.id + '.json'
            let metadataFilePath = path.join(this._outputFolder, metadataFile)
            
            fs.unlink(metadataFilePath, function(err) {
                if(err) {
                    reject(new Error(`Unable to delete ${audioFilePath} file`))
                } else {
                    resolve(metadataFilePath)
                }
           });
        })
    }

    checkExistsAudioFile (id) {
        return new Promise((resolve) => {
            
            let audioFile = id + '.wav'
            let audioFilePath = path.join(this._outputFolder, audioFile)
            
            fs.exists(audioFilePath, (exist) => {
                if(exist) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            })
        })
    }

    checkExistsMetadataFile (id) {
        return new Promise((resolve) => {
            
            let metadataFile = id + '.json'
            let metadataFilePath = path.join(this._outputFolder, metadataFile)
            
            fs.exists(metadataFilePath, (exist) => {
                if(exist) {
                    resolve(true)
                } else {
                    resolve(false)
                }
            })
        })
    }

    truncateRecordings(result) {
        return {
            context : result.context || '' ,
            location : result.location || '',
            department : result.department || '',
            id : result.id || '',
            callid : result.callid || '',
            userid : result.userid || '',
            linkedId : result.linkedID || '',
            extension : result.extensionID || '',
            source : result.source || '',
            destination : result.destination || '',
            direction : this._getDirection(result.direction),
            duration : result.duration || '',
            start : result.start || '',
            end : result.end || '',
            mediaRetentionDateLimit : result.mediaRetentionDateLimit || '',
            awsS3ObjectID : result.awsS3ObjectID || '',
            awsS3Bucket : result.awsS3Bucket || ''
        }
    }
}