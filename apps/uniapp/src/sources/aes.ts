import CryptoJS from 'crypto-js'

/** 笔趣阁/猫眼看书 APK 章节 path 解密 */
const AES_KEY = CryptoJS.enc.Utf8.parse('f041c49714d39908')
const AES_IV = CryptoJS.enc.Utf8.parse('0123456789abcdef')

export function aesCbcDecryptBase64(encryptedBase64: string): string {
  if (!encryptedBase64) return ''
  try {
    const params = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(encryptedBase64),
    })
    const decrypted = CryptoJS.AES.decrypt(params, AES_KEY, {
      iv: AES_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    })
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}
