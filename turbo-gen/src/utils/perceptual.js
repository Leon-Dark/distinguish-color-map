export function sRGBToLinear(c) {
    if (c <= 0.04045) {
        return c / 12.92;
    } else {
        return Math.pow((c + 0.055) / 1.055, 2.4);
    }
}

export function linearToSRGB(c) {
    if (c <= 0.0031308) {
        return 12.92 * c;
    } else {
        return 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
    }
}

export function sRGBToOKLab(rgb) {
    const linearRGB = [sRGBToLinear(rgb[0]), sRGBToLinear(rgb[1]), sRGBToLinear(rgb[2])];
    const l = 0.4122214708 * linearRGB[0] + 0.5363325363 * linearRGB[1] + 0.0514459929 * linearRGB[2];
    const m = 0.2119034982 * linearRGB[0] + 0.6806995451 * linearRGB[1] + 0.1073969566 * linearRGB[2];
    const s = 0.0883024619 * linearRGB[0] + 0.2817188376 * linearRGB[1] + 0.6299787005 * linearRGB[2];

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
}

export function OKLabToOKLCH(lab) {
    const L = lab[0];
    const a = lab[1];
    const b = lab[2];

    const C = Math.sqrt(a * a + b * b);
    let h = Math.atan2(b, a) * (180 / Math.PI);

    if (h < 0) {
        h += 360;
    }

    return [L, C, h];
}

export function okLabToSRGB(lab) {
    const L = lab[0];
    const a = lab[1];
    const b = lab[2];

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return [
        Math.max(0, Math.min(1, linearToSRGB(lr))),
        Math.max(0, Math.min(1, linearToSRGB(lg))),
        Math.max(0, Math.min(1, linearToSRGB(lb)))
    ];
}

export function deltaE_OKLab(lab1, lab2) {
    const dL = lab1[0] - lab2[0];
    const da = lab1[1] - lab2[1];
    const db = lab1[2] - lab2[2];
    return Math.sqrt(dL * dL + da * da + db * db);
}

export function distance3D(p1, p2) {
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    const dz = p1[2] - p2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
