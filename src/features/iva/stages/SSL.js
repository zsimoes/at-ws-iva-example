import request from 'request-promise';
import config from 'config';

import IVAXmlBuilder from './IVAXmlBuilder';

import { debugLogWithSeparators } from '../util/util';

const webserviceOptions = config.get('webservice.iva.webserviceOptions');

export default class SSL {
  static async sendRequest(target, xml) {
    const requestOptions = await IVAXmlBuilder.prepareRequestOptions(
      webserviceOptions?.requestOptions?.[target]
    );
    const endpoint = webserviceOptions?.targets?.[target];

    var options = {
      resolveWithFullResponse: true,
      url: endpoint,
      method: 'POST',
      gzip: true,
      body: xml,
      headers: {
        //'Content-Type': 'text/xml',
        'Content-Type': 'application/soap+xml; charset=UTF-8',
        'Content-Length': Buffer.byteLength(xml),
        SOAPAction:
          'https://servicos.portaldasfinancas.gov.pt/dpivaws/DeclaracaoPeriodicaIVAWebService#tns:submeterDeclaracao'
      },
      ...requestOptions
    };

    debugLogWithSeparators('HTTP request options', {
      ...options,
      body: 'abbreviated',
      pfx: 'abbreviated',
      cert: 'abbreviated',
      key: 'abbreviated',
      ca: 'abbreviated'
    });

    const response = await request(options);

    let { statusCode, statusMessage, complete } = response;

    debugLogWithSeparators('HTTP RESPONSE', {
      statusCode,
      statusMessage,
      complete
    });

    return response;
  }
}
