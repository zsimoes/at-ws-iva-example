import xml2js from 'xml2js';

import { throwHttpError, throwIfAbsent } from '../../../common/util';
import { debugLogWithSeparators } from './util';

const getSoapResponse = xmlJsonRawResponse => {
  const soapBody = xmlJsonRawResponse?.['SOAP-ENV:Envelope']?.['SOAP-ENV:Body'];
  throwIfAbsent(soapBody, 'Corpo da resposta AT (SOAP) inexistente', 500);

  const bodyKeys = Object.keys(soapBody);
  const responseElementOk =
    bodyKeys?.[0] && bodyKeys[0]?.toLowerCase?.()?.includes('response');

  throwIfAbsent(
    responseElementOk,
    'Corpo da resposta AT (SOAP) tem elementos em falta (Submeter/Validar Response element)',
    500
  );

  const responseElement = soapBody[bodyKeys[0]];

  return responseElement;
};

const formatSuccess = submissionData => {
  return `Data: ${submissionData.data}
Ano: ${submissionData.ano}
Periodo: ${submissionData.periodo}
idDeclaracao: ${submissionData.idDeclaracao}
Contribuinte: ${submissionData.contribuinte?.[0]?.nif}
TOC: ${submissionData.contribuinte?.[1]?.nif}`;
};

const formatErrors = errorObject => {
  const error = errorObject?.erro;
  return `(${error?.anexo} - ${error?.quadro} - ${error?.codigo}): ${
    error?.mensagem
  }. Tem mais erros: ${errorObject?.temMaisErros}`;
};

export default class SoapResponseHandler {
  static async parseResponse(response) {
    let { statusMessage, body } = response;

    try {
      const parser = new xml2js.Parser({ explicitArray: false, trim: true });
      body = await parser.parseStringPromise(body);
    } catch (err) {
      throwHttpError(body, statusMessage);
    }

    debugLogWithSeparators('RESPONSE BODY', body);

    const soapResponse = getSoapResponse(body);

    const code = soapResponse.codigo;
    const mensagem = soapResponse.mensagem;
    const dadosSubmissao = soapResponse.dadosSubmissao;
    const erros = soapResponse.erros;

    let message;

    if (dadosSubmissao) {
      message = formatSuccess(dadosSubmissao);
    } else if (erros) {
      message = formatErrors(erros);
    } else {
      message = mensagem;
    }

    return { code, message };
  }
}
