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
            if (markUpElement.column) {
                element.direction = 'v';
            } else if (markUpElement.row) {
                element.direction = 'h';
            }
            for (let i = 0; i < children.length; i++) {
                const childElement = this.compile(children[i]);
                element.children.push(childElement);
            }
            element.calculateLengthAndBreadth();
        } else {
            // leaf
            element.translation = [0, 0];
            element.scale = [1, 1]; 
        }
        return element;
    }

    static findParent(element, target) {
        for (let i = 0; i < element.children.length; i++) {
            const child = element.children[i];
            if (child == target) {
                return element;
            } else {
                const parent = this.findParent(child, target);
                if (parent) {
                    return parent;
                }
            }
        }
        return null;
    }

    static eraseElement(root, target) {
        const parent = this.findParent(root, target);
        if (parent) {
            if (parent.children.length === 1) { 
                // 兄弟がいない場合は親を削除する
                this.eraseElement(root, parent);
            } else {
                // 兄弟がいる場合は親から削除する
                const index = parent.children.indexOf(target);
                parent.children.splice(index, 1);
                parent.calculateLengthAndBreadth();
            }
        }
        // ルート要素は削除できない
    }

    calculateLengthAndBreadth() {
        let totalLength = 0;
        if (this.direction == 'v') {
            totalLength = this.margin.top + this.margin.bottom;
            this.localBreadth = this.margin.left + this.rawSize + this.margin.right;
        } else if (this.direction == 'h') {
            totalLength = this.margin.left + this.margin.right;
            this.localBreadth = this.margin.top + this.rawSize + this.margin.bottom;
        }
        for (let i = 0; i < this.children.length; i++) {
            const child = this.children[i];
            totalLength += child.rawSize + this.spacing;
        }
        totalLength -= this.spacing;
        this.localLength = totalLength;
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