import fsPckg from 'fs';
import canvasPckg from 'canvas';
const { createCanvas, loadImage } = canvasPckg

export function makeScrambleImage(scramble) {
    const links = ['http://cube.rider.biz/visualcube.png?fmt=png&size=150&alg=x2' + scramble, 'http://cube.rider.biz/visualcube.png?fmt=png&size=150&alg=x2' + scramble + 'z2y'];

    console.log(links);

    return links;
}