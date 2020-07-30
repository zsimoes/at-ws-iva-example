import mongoose from "mongoose";
import constants from "./util/constants";
import IVAXmlBuilder from "./stages/IVAXmlBuilder";
import SSL from "./stages/SSL.js";
import { debugLogDeliveryStart, debugLogWithSeparators } from "./util/util";
import SoapErrorHandler from "./util/SoapResponseHandler";

const { ObjectId } = mongoose.Types;

let logger;

// abreviado...

const sendIva = async (target, cleanXmlBuilder, ivaInfo) => {
  const result = {
    stages: {},
    status: constants.webserviceStatuses.FAIL,
    errorList: [],
    warningList: [],
  };

  debugLogDeliveryStart(ivaInfo);

  let declaration;
  try {
    declaration = await IVAXmlBuilder.getDeclaration(ivaInfo?.file);
  } catch (error) {
    stageFail(result, "webserviceRequest", error.message, null, false);
    logger.error(error.stack);
    return result;
  }

  try {
    let xml = await cleanXmlBuilder.getCleanXml(
      ivaInfo.consistency?.at?.username,
      declaration
    );

    const response = await SSL.sendRequest(target, xml);

    const { code, message } = await SoapErrorHandler.parseResponse(response);

    if (code !== "0") {
      stageFail(
        result,
        "webserviceRequest",
        `Erro AT - ${code ? code + ": " : ""}${message}`,
        null,
        false
      );
      return result;
    } else {
      stageOk(result, "webserviceRequest", message);
    }
  } catch (err) {
    let { code, message } = err;

    stageFail(
      result,
      "webserviceRequest",
      `Erro - ${code ? code + ": " : ""}${message}`,
      null,
      false
    );
    debugLogWithSeparators(
      "IVA WS: ERRO INTERNO",
      { code, stack: err.stack },
      "error",
      true
    );
    return result;
  }

  return result;
  //await safeClick(page, 'sendDeclaration.GET_DOCUMENT');
};

// Mutation
const stageOk = (resultObject, stageName, data = {}) => {
  // abreviado...
};

// Mutation
const stageFail = (
  resultObject,
  stageName,
  reasonString,
  data = {},
  logEvent = true
) => {
  // abreviado...
};

const prepareDeliveryList = (ivaList) => {
  ivaList.forEach(
    (iva) =>
      (iva.report = {
        errorList: [],
        warningList: [],
        status: constants.webserviceStatuses.OK,
      })
  );
  return ivaList;
};

export default { prepareDeliveryList, sendIva };
