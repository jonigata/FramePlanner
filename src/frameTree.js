export class FrameElement {
    constructor(size) {
        // 保持するのは兄弟間でのみ有効な相対サイズ（ローカル座標）
        // 絶対座標はレンダリング時に算出する
        this.rawSize = size;
        this.direction = null;
        this.children = [];
        this.localLength = 0; // 子要素の進行方向サイズ
        this.localBreadth = 0; // 子要素の進行方向以外のサイズ

        // リーフ要素の場合は絵がある可能性がある
        this.image = null;
    }

    static compile(markUpElement) {
        const width = markUpElement.width || 1;
        const height = markUpElement.height || 1;
        const element = new FrameElement(markUpElement.width || markUpElement.height || 1);
        const children = markUpElement.column || markUpElement.row;
        element.spacing = markUpElement.spacing || 0;
        element.margin = {top:0, bottom:0, left:0, right:0};
        Object.assign(element.margin, markUpElement.margin || {});

        if (children) {
            let totalLength = 0;
            if (markUpElement.column) {
                element.direction = 'v';
                totalLength = element.margin.top + element.margin.bottom;
                element.localBreadth = element.margin.left + width + element.margin.right;
            } else if (markUpElement.row) {
                element.direction = 'h';
                totalLength = element.margin.left + element.margin.right;
                element.localBreadth = element.margin.top + height + element.margin.bottom;
            }
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                const childElement = this.compile(child);
                totalLength += childElement.rawSize + element.spacing;
                element.children.push(childElement);
            }
            totalLength -= element.spacing;
            element.localLength = totalLength;
        } else {
            // leaf
            element.translation = [0, 0];
            element.scale = [1, 1]; 
        }
        return element;
    }
}

export function calculatePhysicalLayout(element, size, origin) {
    if (!element.direction) {
        return calculatePhysicalLayoutLeaf(element, size, origin);
    } else {
        return calculatePhysicalLayoutElements(element, size, origin);
    }
}

function calculatePhysicalLayoutElements(element, size, origin) {
    const margin = element.margin;
    const dir = element.direction;
    const psize = element.localLength;
    const ssize = element.localBreadth;
    const xf = dir == 'h' ? size[0] / psize : size[0] / ssize;
    const yf = dir == 'v' ? size[1] / psize : size[1] / ssize;
    const inner_width = (ssize - margin.left - margin.right) * xf;
    const inner_height = (ssize - margin.top - margin.bottom) * yf;
    let x = margin.left;
    let y = margin.top;
    const children = [];
    for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const childOrigin = [origin[0] + x * xf, origin[1] + y * yf];
        const cw = dir == 'h' ? child.rawSize * xf : inner_width;
        const ch = dir == 'v' ? child.rawSize * yf : inner_height;
        const childSize = [cw, ch];
        children.push(calculatePhysicalLayout(child, childSize, childOrigin));
        if (dir == 'h') { x += child.rawSize + element.spacing; }
        if (dir == 'v') { y += child.rawSize + element.spacing; }
    }
    return { size, origin, children };
}

function calculatePhysicalLayoutLeaf(element, size, origin) {
    return { size, origin, element };
}

export function findLayoutAt(layout, position) {
    const [x, y] = position;
    const [ox, oy] = layout.origin;
    const [w, h] = layout.size;
    if (x < ox || x > ox + w || y < oy || y > oy + h) {
        return null;
    }
    if (layout.children) {
        for (let i = 0; i < layout.children.length; i++) {
            const child = layout.children[i];
            const found = findLayoutAt(child, position);
            if (found) { return found; }
        }
    }
    return layout;
}