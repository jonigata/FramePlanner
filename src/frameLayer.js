import { Layer } from "./layeredCanvas.js";
import { FrameElement, calculatePhysicalLayout, findLayoutAt, findBorderAt, makeBorderRect, rectFromPositionAndSize } from "./frameTree.js";
import { translate, scale } from "./pictureControl.js";
import { keyDownFlags } from "./keyCache.js";

export class FrameLayer extends Layer {
    constructor(frameTree, onModify) {
        super();
        this.frameTree = frameTree;
        this.onModify = onModify;
    }

    render(ctx) {
        const size = this.getCanvasSize();
        // render white
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(0, 0, size[0], size[1]);

        const layout = calculatePhysicalLayout(this.frameTree, size, [0, 0]);
        this.renderElement(ctx, layout);

        if (this.borderRect) {
            // fill cyan
            ctx.fillStyle = "rgba(0,200,200,0.7)";
            ctx.fillRect(this.borderRect[0], this.borderRect[1],
                this.borderRect[2] - this.borderRect[0], this.borderRect[3] - this.borderRect[1]);
        }
    }

    renderElement(ctx, layout) {
        if (layout.children){
            for (let i = 0; i < layout.children.length; i++) {
                this.renderElement(ctx, layout.children[i]);
            }
        } else {
            this.renderElementLeaf(ctx, layout);
        }
    }

    renderElementLeaf(ctx, layout) {
        const origin = layout.origin;
        const size = layout.size;

        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(origin[0], origin[1], size[0], size[1]);

        const element = layout.element;
        if (element.image) {
            // clip
            ctx.save();
            ctx.beginPath();
            ctx.rect(origin[0], origin[1], size[0], size[1]);
            ctx.clip();

            const scale = element.scale[0]; // 今のところxとyは同じ
            const [rw, rh] = [element.image.width * scale, element.image.height * scale];
/*

            const [x0, y0] = [origin[0], origin[1]];
            const [x1, y1] = [origin[0] + size[0], origin[1] + size[1]];
            if (x0 < x) { x = x0; }
            if (x + rw < x1) { x = x1 - rw; }
            if (y0 < y) { y = y0; }
            if (y + rh < y1) { y = y1 - rh; }
*/
            let x = origin[0] + (size[0] - rw) / 2 + element.translation[0];
            let y = origin[1] + (size[1] - rh) / 2 + element.translation[1];

            ctx.drawImage(element.image, x, y, element.image.width * scale, element.image.height * scale);

            // unclip
            ctx.restore();
        }

        ctx.strokeStyle = "rgb(0,0,0)";
        ctx.lineWidth = 1;
        ctx.strokeRect(origin[0], origin[1], size[0], size[1]);
    }

    dropped(image, position) {
        const size = [image.width, image.height];
        const layout = calculatePhysicalLayout(this.frameTree, this.getCanvasSize(), [0, 0]);
        let layoutlet = findLayoutAt(layout, position);
        if (layoutlet) {
            // calc expansion to longer size
            const scale = Math.max(layoutlet.size[0] / size[0], layoutlet.size[1] / size[1]);
            layoutlet.element.scale = [scale, scale];
            layoutlet.element.image = image;
            this.redraw();
            return true;
        }
        return false;
    }

    pointerHover(point) {
        const layout = calculatePhysicalLayout(this.frameTree, this.getCanvasSize(), [0, 0]);
        const border = findBorderAt(layout, point);
        if (border) {
            console.log("border detect");
            this.borderRect = makeBorderRect(border.layout, border.index);
        } else {
            this.borderRect = null;
        }
        this.redraw();
    }

    accepts(point) {
        const layout = calculatePhysicalLayout(this.frameTree, this.getCanvasSize(), [0, 0]);
        const layoutElement = findLayoutAt(layout, point);
        if (layoutElement) {
            if (keyDownFlags["KeyQ"]) {
                FrameElement.eraseElement(this.frameTree, layoutElement.element);
                this.redraw();
            }
            if (keyDownFlags["KeyW"]) {
                FrameElement.splitElementHorizontal(this.frameTree, layoutElement.element);
                this.onModify(this.frameTree);
                this.redraw();
            }
            if (keyDownFlags["KeyS"]) {
                FrameElement.splitElementVertical(this.frameTree, layoutElement.element);
                this.onModify(this.frameTree);
                this.redraw();
            }
            if (layoutElement.element.image) {
                console.log("accepts");
                return { layout: layoutElement };
            }
        }

        const border = findBorderAt(layout, point);
        if (border) {
            return { border: border };
        }
        
        return null;
    }

    *pointer(p, payload) {
        if (payload.layout) {
            const layout = payload.layout;
            const element = layout.element;
            if (keyDownFlags["AltLeft"] || keyDownFlags["AltRight"]) {
                const origin = element.translation;
                yield* translate(p, (q) => {
                    element.translation = [origin[0] + q[0], origin[1] + q[1]];
                    this.constraintTranslationAndScale(layout);
                    this.redraw(); // TODO: できれば、移動した要素だけ再描画したい
                });
            } else if (keyDownFlags["ControlLeft"] || keyDownFlags["ControlRight"]) {
                const origin = element.scale[0];
                const size = layout.size;
                yield* scale(p, (q) => {
                    const s = Math.max(q[0], q[1]);
                    element.scale = [origin * s, origin * s];
                    this.constraintTranslationAndScale(layout);
                    this.redraw(); // TODO: できれば、移動した要素だけ再描画したい
                });
            }
        } else {
            if (keyDownFlags["ControlLeft"] || keyDownFlags["ControlRight"]) {
                yield* this.expandBorder(p, payload.border);
            } else {
                yield* this.moveBorder(p, payload.border);
            }
        }
    }

    *moveBorder(p, border) {
        const layout = border.layout;
        const index = border.index;

        const child0 = layout.children[index-1];
        const child1 = layout.children[index];

        const c0 = child0.element;
        const c1 = child1.element;
        const rawSpacing = layout.element.spacing;
        const rawSum = c0.rawSize + rawSpacing + c1.rawSize;

        while (p = yield) {
            const balance = this.getBorderBalance(p, border);
            const t = balance * rawSum;
            c0.rawSize = t - rawSpacing * 0.5;
            c1.rawSize = rawSum - t - rawSpacing * 0.5;
            this.redraw();
        }

        this.onModify(this.frameTree);
    }

    *expandBorder(p, border) {
        const element = border.layout.element;
        const rawSpacing = element.spacing;
        const dir = border.layout.dir == 'h' ? 0 : 1;
        const factor = border.layout.size[dir] / this.getCanvasSize()[dir];
        const s = p;

        while (p = yield) {
            const op = border.layout.dir == 'h' ? p[0] - s[0] : p[1] - s[1];
            element.spacing = Math.max(0, rawSpacing + op * factor * 0.1);
            element.calculateLengthAndBreadth();
            this.redraw();
        }

        this.onModify(this.frameTree);
    }

    getBorderBalance(p, border) {
        const layout = border.layout;
        const index = border.index;

        const child0 = layout.children[index-1];
        const child1 = layout.children[index];

        const rect0 = rectFromPositionAndSize(child0.origin, child0.size);
        const rect1 = rectFromPositionAndSize(child1.origin, child1.size);

        let t; // 0.0 - 1.0, 0.0: top or left of rect0, 1.0: right or bottom of rect1
        if (layout.dir == 'h') {
            t = (p[0] - rect0[0]) / (rect1[2] - rect0[0]);
        } else {
            t = (p[1] - rect0[1]) / (rect1[3] - rect0[1]);
        }
        return t;
    }

    constraintAll() {
        const layout = calculatePhysicalLayout(this.frameTree, this.getCanvasSize(), [0, 0]);
        this.constraintAllRecursive(layout);
    }

    constraintAllRecursive(layout) {
        if (layout.children) {
            for (const child of layout.children) {
                this.constraintAllRecursive(child);
            }
        } else if (layout.element && layout.element.image) {
            this.constraintTranslationAndScale(layout);
        }
    }

    constraintTranslationAndScale(layout) {
        const element = layout.element;
        const origin = layout.origin;
        const size = layout.size;

        let scale = element.scale[0];
        
        if (element.image.width * scale < size[0]) {
            scale = size[0] / element.image.width;
        }
        if (element.image.height * scale < size[1]) {
            scale = size[1] / element.image.height;
        }

        const [rw, rh] = [element.image.width * scale, element.image.height * scale];
        const [x0, y0] = [origin[0], origin[1]];
        const [x1, y1] = [origin[0] + size[0], origin[1] + size[1]];
        const x = origin[0] + (size[0] - rw) / 2 + element.translation[0];
        const y = origin[1] + (size[1] - rh) / 2 + element.translation[1];

        if (x0 < x) { element.translation[0] = x0 - origin[0] - (size[0] - rw) / 2; }
        if (x + rw < x1) { element.translation[0] = x1 - origin[0] - (size[0] - rw) / 2 - rw; }
        if (y0 < y) { element.translation[1] = y0 - origin[1] - (size[1] - rh) / 2; }
        if (y + rh < y1) { element.translation[1] = y1 - origin[1] - (size[1] - rh) / 2 - rh; }
    }

}
