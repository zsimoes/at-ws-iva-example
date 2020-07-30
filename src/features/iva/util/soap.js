import crypto from 'crypto';
import moment from 'moment';

moment.tz.setDefault('UTC');

export default class SoapUtil {
  static getTimestamp = () => {
    //return moment().format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
    return moment().format('YYYY-MM-DDTHH:mm:ss.S[Z]');
  };

  static insertString = (content, target, index) => {
    return [target.slice(0, index), content, target.slice(index)].join('');
  };

  static toBase64 = string => Buffer.from(string).toString('base64');

  static passwordDigest64 = (
    initialBytes,
    createdBytes,
    passwordBytes,
    symmetricKeyBytes
  ) => {
    // digest = base64 ( AES ( sha1 ( nonce + created + password ) ), ks )
    const fullBytes = Buffer.concat([
      initialBytes,
      createdBytes,
      passwordBytes
    ]);

    const sha1Hash = crypto.createHash('sha1');
    sha1Hash.update(fullBytes);

    const sha1Digest = sha1Hash.digest('base64');

    const sha1Buffer = Buffer.from(sha1Digest, 'base64');

    const aesEncrypted = SoapUtil.aesEncrypt64(sha1Buffer, symmetricKeyBytes);

    return aesEncrypted;
  };

  static xmlEscape = obj => {
    if (typeof obj === 'string') {
      if (obj.substr(0, 9) === '<![CDATA[' && obj.substr(-3) === ']]>') {
        return obj;
      }
      return obj
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    return obj;
  };

  // 16 bytes = 128 bits
  static getRandomBytes = (size = 16) => {
    return crypto.randomBytes(size);
  };

  static rsaEncrypt64 = (byteBuffer, key) => {
    let encryptBuff = crypto.publicEncrypt(
      { key, padding: crypto.constants.RSA_PKCS1_PADDING },
      byteBuffer
    );
    return encryptBuff.toString('base64');
  };

  static aesEncrypt64 = (
    data,
    aesSecret,
    cipherName = 'aes-128-ecb',
    initializationVector = null,
    inputEncoding = 'utf8',
    outputEncoding = 'base64'
  ) => {
    const cipher = crypto.createCipheriv(
      cipherName,
      aesSecret,
      initializationVector
    );
    let encrypted = cipher.update(data, inputEncoding, outputEncoding);
    encrypted += cipher.final(outputEncoding);
    return encrypted;
  };
}
