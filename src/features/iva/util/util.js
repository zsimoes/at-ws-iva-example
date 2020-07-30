import config from 'config';
import { scraperLog } from '../../../common/log';

let logger;
(async () => {
  logger = await scraperLog('iva', {
    file: config.get('log.webservice.iva.file'),
    console: config.get('log.webservice.iva.console')
  });
})();

const isDevelopment = process.env.NODE_ENV === 'development';
const separator = length => new Array(length).fill('-').join('');

export const debugLogDeliveryStart = ivaInfo => {
  if (isDevelopment) {
    logger.info(
      '\n\n\n\n' +
        separator(40) +
        '\n' +
        'Delivery ( nif ' +
        ivaInfo.consistency?.nif +
        ' ) ' +
        +ivaInfo.consistency?.name +
        '\n' +
        separator(40) +
        '\n\n'
    );
  }
};

export const debugLogWithSeparators = (
  title,
  content,
  level = 'info',
  logInProduction = false
) => {
  if (isDevelopment || logInProduction) {
    const toLog =
      '\n\n' +
      title +
      '\n' +
      separator(40) +
      '\n' +
      JSON.stringify(content, null, 2) +
      '\n' +
      separator(40) +
      '\n\n';
    switch (level) {
      case 'error':
        logger.error(toLog);
        break;
      case 'info':
      // intentional fallthrough
      default:
        logger.info(toLog);
    }
  }
};
