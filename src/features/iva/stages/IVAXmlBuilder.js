import fs from "fs";

import autobind from "auto-bind";
import config from "config";
import formatter from "xml-formatter";
import archiver from "archiver";
import bufferList from "bl";

import { scraperLog } from "../../../common/log";
import { throwIfAbsent } from "../../../common/util";
import SoapUtil from "../util/soap";

let logger;
(async () => {
  if (!logger) {
    logger = await scraperLog("iva", {
      file: config.get("log.webservice.iva.file"),
      console: config.get("log.webservice.iva.console"),
    });
  }
})();

const debugLog =
  process.env.NODE_ENV !== "development"
    ? () => {}
    : (message) => {
        logger.info(JSON.stringify(message, null, 2));
      };

const separator = (length) => new Array(length).fill("-").join("");

export default class AtWss {
  credentialMap;
  serverPublicKey;

  constructor() {
    autobind(this);
  }

  /*
   * Constructor
   */

  static async build(credentialMap, serverPublicKeyPath) {
    const wss = new AtWss();
    wss.credentialMap = credentialMap;

    let serverPublicKey = await fs.promises.readFile(serverPublicKeyPath, {
      encoding: "utf8",
    });
    throwIfAbsent(
      serverPublicKey,
      `Webservice initialization error: undefined server public key `,
      500
    );
    wss.serverPublicKey = serverPublicKey;

    return wss;
  }

  getCleanXml(clientId, declaration) {
    // AT defines these initial 16 random bytes (128 random bits) as "Ks", so we're doing the same for clarity
    const ksClient = SoapUtil.getRandomBytes(16);
    const ksToc = SoapUtil.getRandomBytes(16);

    // Nonce = base64 ( Rsa ( randomBytes, AtPubKey  ) )
    let nonceClient, nonceToc;

    nonceClient = SoapUtil.rsaEncrypt64(ksClient, this.serverPublicKey);
    nonceToc = SoapUtil.rsaEncrypt64(ksToc, this.serverPublicKey);

    const created = SoapUtil.getTimestamp();
    const createdToc = SoapUtil.getTimestamp();
    //const created64 = Buffer.from(created, 'utf8').toString('base64');

    // credentialMap format is:  { clients: { username*: { username, password }* }, toc: { username, pass } }
    const clientCredentials = this.credentialMap?.clients?.[clientId];
    throwIfAbsent(
      clientCredentials,
      "IVA Send: client credentials not found in credential map",
      500
    );

    // clientId = '599999993/0037';
    // const clientPassword = 'testes1234';
    const clientPassword = clientCredentials.password;
    let clientPasswordEncrypted = SoapUtil.aesEncrypt64(
      Buffer.from(clientPassword, "utf8"),
      ksClient
    );

    const clientPasswordDigest = SoapUtil.passwordDigest64(
      ksClient,
      Buffer.from(created, "utf8"),
      Buffer.from(clientPassword, "utf8"),
      ksClient
    );

    const hasToc = this.credentialMap?.toc;

    let fullXml;

    if (hasToc) {
      const tocCredentials = this.credentialMap?.toc;
      throwIfAbsent(
        tocCredentials,
        "IVA Send: TOC credentials not found in credential map",
        500
      );

      const tocPassword = tocCredentials.password;
      const tocPasswordEncrypted = SoapUtil.aesEncrypt64(
        Buffer.from(tocPassword, "utf8"),
        ksToc
      );

      const tocPasswordDigest = SoapUtil.passwordDigest64(
        ksToc,
        Buffer.from(createdToc, "utf8"),
        Buffer.from(tocPassword, "utf8"),
        ksToc
      );

      fullXml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
    <S:Envelope
      xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"
      >
      <S:Header>
        <wss:Security xmlns:at="http://at.pt/wsp/auth" xmlns:wss="http://schemas.xmlsoap.org/ws/2002/12/secext" S:Actor="http://at.pt/actor/SPA" at:Version="2">
          <wss:UsernameToken>
            <wss:Username>${clientId.trim()}</wss:Username>
            <wss:Nonce>${nonceClient}</wss:Nonce>
            <wss:Password Type="wss:PasswordDigest" Digest="${clientPasswordDigest}" >${clientPasswordEncrypted}</wss:Password>
            <wss:Created>${created}</wss:Created>
          </wss:UsernameToken>
        </wss:Security>
        <wss:Security xmlns:at="http://at.pt/wsp/auth" xmlns:wss="http://schemas.xmlsoap.org/ws/2002/12/secext" S:Actor="http://at.pt/actor/TOC" at:Version="2">
          <wss:UsernameToken>
            <wss:Username>${tocCredentials.username.trim()}</wss:Username>
            <wss:Nonce>${nonceToc}</wss:Nonce>
            <wss:Password Type="wss:PasswordDigest" Digest="${tocPasswordDigest}">${tocPasswordEncrypted.trim()}</wss:Password>
            <wss:Created>${createdToc}</wss:Created>
          </wss:UsernameToken>
        </wss:Security>
      </S:Header>
      <S:Body>
        <tns:submeterDeclaracaoPeriodicaIVARequest xmlns:tns="https://servicos.portaldasfinancas.gov.pt/dpivaws/DeclaracaoPeriodicaIVAWebService">
          <versaoDeclaracao>2016</versaoDeclaracao>
          <declaracao>${declaration}</declaracao>
        </tns:submeterDeclaracaoPeriodicaIVARequest>
      </S:Body>
    </S:Envelope>`;
    } else {
      fullXml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>
    <S:Envelope
      xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"
      xmlns:at="http://at.pt/wsp/auth" 
      xmlns:wss="http://schemas.xmlsoap.org/ws/2002/12/secext"      >
      <S:Header>
        <wss:Security S:Actor="http://at.pt/actor/SPA" at:Version="2">
          <wss:UsernameToken>
            <wss:Username>${clientId.trim()}</wss:Username>
            <wss:Nonce>${nonceClient}</wss:Nonce>
            <wss:Password Type="wss:PasswordDigest" Digest="${clientPasswordDigest}" >${clientPasswordEncrypted}</wss:Password>
            <wss:Created>${created}</wss:Created>
          </wss:UsernameToken>
        </wss:Security>
      </S:Header>
      <S:Body>
        <tns:submeterDeclaracaoPeriodicaIVARequest xmlns:tns="https://servicos.portaldasfinancas.gov.pt/dpivaws/DeclaracaoPeriodicaIVAWebService">
          <versaoDeclaracao>2016</versaoDeclaracao>
          <declaracao>${declaration}</declaracao>
          <aceitaAlertas>true</aceitaAlertas>
        </tns:submeterDeclaracaoPeriodicaIVARequest>
      </S:Body>
    </S:Envelope>`;
    }

    fullXml = fullXml.replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, " ");

    let formatted = fullXml;
    try {
      formatted = formatter(fullXml, {
        indentation: "  ",
        lineSeparator: "\n",
      });
    } catch (err) {
      //nothing
    }

    debugLog("\n\n\nXML:\n" + separator(40) + "\n");
    debugLog(formatted);
    debugLog("\n" + separator(40) + " /XML" + "\n\n");

    fullXml = Buffer.from(fullXml).toString("utf8");
    return fullXml;
  }

  static async getDeclaration(filePath) {
    let declaration = await fs.promises.readFile(filePath);

    //* ZIP Stuff ----
    let zipBuffer;
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(
      bufferList((err, data) => {
        if (err) {
          // FIXME handle this in a sane way
          zipBuffer = "ERROR IN DECLARATION ZIP STREAM ";
          logger.error(
            "Error in Archiver pipe: " + err.message ??
              JSON.stringify(err, null, 2)
          );
        }
        zipBuffer = data;
      })
    );
    archive.append(declaration, { name: "data.txt" });
    await archive.finalize();
    //* End ZIP Suff ----

    declaration = zipBuffer.toString("base64");
    declaration = Buffer.from(declaration, "utf8").toString("base64");

    return declaration;
  }

  /* For SSL: read certificates from disk */
  static prepareRequestOptions = async (requestOptions) => {
    const clone = JSON.parse(JSON.stringify(requestOptions));

    for (const key of ["ca", "cert", "key", "pfx"]) {
      if (key in requestOptions) {
        const buffer = await fs.promises.readFile(requestOptions[key]);
        clone[key] = buffer;
      }
    }

    return clone;
  };
}
