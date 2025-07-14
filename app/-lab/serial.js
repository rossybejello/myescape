export function makeSerial() {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let code = '';
  crypto.getRandomValues(new Uint8Array(10)).forEach(b => {
    code += alphabet[b % alphabet.length];
  });
  return code;
}
