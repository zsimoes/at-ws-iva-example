import fs from 'fs';
import { promisify } from 'bluebird';
import config from 'config';
import rmrf from 'rimraf';
import extract from 'extract-zip';
import xml2js from 'xml2js';
import { scraperLog } from '../../../common/log';
import constants from '../util/constants';

const rimraf = promisify(rmrf);

let logger;
const folders = config.get('webservice.iva.folders');
const files = config.get('webservice.iva.files');

const init = (async () => {
  logger = await scraperLog('iva', {
    file: config.get('log.webservice.iva.file'),
    console: config.get('log.webservice.iva.console')
  });

  await makeDirs();
})();

const makeDirs = async () => {
  for (const key in folders) {
    const folder = folders[key];
    try {
      await fs.promises.access(folder, fs.F_OK);
    } catch (error) {
      //Folder does not exist or cannot be accessed
      try {
        await fs.promises.mkdir(folder, { recursive: true, mode: 0o777 });
        logger.info('Init: Created folder ' + key + ' [' + folder + ']');
      } catch (error) {
        console.error(error.message);
        console.error(
          'IVA Webservice: cannot create base folder ' + folder + '. Exiting'
        );
        process.exit();
      }
    }
  }
};

export default class IvaFiles {
  static async deleteTempFiles() {
    await init;
    const rimrafs = [];
    const folders = config.get('webservice.iva.resetfolders');
    for (const key in folders) {
      const folder = folders[key];
      rimrafs.push(
        rimraf(folder + '*').then(() => {
          logger.debug('Rimraffed ' + folder);
          return;
        })
      );
    }
    return await Promise.all(rimrafs);
  }

  static async deleteZip() {
    await init;
    await fs.promises.unlink(folders.zipUpload + files.zipUpload);
  }

  static async extractZip(filePath) {
    await init;
    await extract(filePath, { dir: folders.extract });
    let fileList = await fs.promises.readdir(folders.extract);
    fileList = fileList.map(file => folders.extract + file);
    return fileList;
  }

  static async populateList(ivaList) {
    await init;
    for (const ivaInfo of ivaList) {
      if (
        !(await this.checkFileExtension(
          ivaInfo.file,
          constants.files.IVA_EXTENSION
        ))
      ) {
        logger.error(
          `IVA Error (${ivaInfo.file}): ${constants.errors.WRONG_EXTENSION}`
        );
        ivaInfo.consistency.errorList.push(constants.errors.WRONG_EXTENSION);
        continue;
      }
      await this.populateSingle(ivaInfo);
    }
  }

  static async checkFileExtension(filePath, extension) {
    if (filePath.endsWith(extension)) {
      return true;
    }
    return false;
  }

  static async populateSingle(ivaInfo) {
    await init;

    let jsonResult;
    let clientNif;
    let year;
    let period;
    try {
      const parser = new xml2js.Parser();
      const fileData = await fs.promises.readFile(ivaInfo.file, 'utf8');
      jsonResult = await new Promise(r =>
        parser.parseString(fileData, function(err, result) {
          return r(result);
        })
      );

      jsonResult.dpiva.rosto = jsonResult.dpiva.rosto[0];
      jsonResult.dpiva.rosto.apuramento = jsonResult.dpiva.rosto.apuramento[0];
      jsonResult.dpiva.rosto.desenvolvimento =
        jsonResult.dpiva.rosto.desenvolvimento[0];
      jsonResult.dpiva.rosto.inicio = jsonResult.dpiva.rosto.inicio[0];

      for (const key of Object.keys(jsonResult.dpiva.rosto.inicio)) {
        const array = jsonResult.dpiva.rosto.inicio[key];
        if (array.length) {
          jsonResult.dpiva.rosto.inicio[key] = array[0];
        }
      }

      clientNif = jsonResult.dpiva.rosto.inicio.nif;
      year = jsonResult.dpiva.rosto.inicio.anoDeclaracao;
      period = jsonResult.dpiva.rosto.inicio.periodoDeclaracao;

      if (!clientNif) {
        throw new Error('Dclaration File: Client NIF not found');
      }
      if (!year) {
        throw new Error('Dclaration File: Declaration year not found');
      }
      if (!period) {
        throw new Error('Dclaration File: Declaration period not found');
      }
    } catch (err) {
      logger.error(
        `IVA Error (${ivaInfo.file}): ${constants.errors.CANT_OPEN_FILE}`
      );
      logger.error(`${err.message}\n${err.stack}`);
      ivaInfo.consistency.errorList.push(constants.errors.CANT_OPEN_FILE);
      return;
    }

    ivaInfo.consistency.fileData = {};

    ivaInfo.consistency.fileData.nif = clientNif;
    ivaInfo.consistency.fileData.year = year;
    ivaInfo.consistency.fileData.period = period;

    return;
  }
}
