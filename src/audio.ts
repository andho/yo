//export function bufferSound(ctx: AudioContext, url: string) {
//  return new Promise<AudioBuffer>(function (resolve, reject) {
//    const req = new XMLHttpRequest();
//    req.open("GET", url, true);
//    req.responseType = "arraybuffer";
//    req.onload = function () {
//      console.log("got file", req.responseType);
//      ctx.decodeAudioData(req.response, resolve, reject);
//    };
//    req.send();
//  });
//}

export function loadAudio(url: string) {
  //return fetch(url);
  return new Promise<AudioBuffer>(function (resolve, reject) {
    const req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onload = function () {
      const ctx = new AudioContext();
      ctx.decodeAudioData(req.response, resolve, reject);
    };
    req.onerror = (e) => reject(e);
    req.send();
  });
}

//const audioContext = new AudioContext();
//bufferSound(audioContext, audioSrc).then(function (buffer: AudioBuffer) {
//  const g = audioContext.createGain();
//  g.gain.value = 5;
//  g.connect(audioContext.destination);
//
//  const bq = audioContext.createBiquadFilter();
//  // found out about detune here: http://chimera.labs.oreilly.com/books/1234000001552/ch04.html
//  bq.detune.value = -1200;
//  bq.connect(g);
//
//  const src = audioContext.createBufferSource();
//  src.buffer = buffer;
//  src.connect(bq);
//
//  src.start();
//});
