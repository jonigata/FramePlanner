import { LayeredCanvas, Layer, sequentializePointer } from "./layeredCanvas.js";
import { FrameElement, calculatePhysicalLayout, findLayoutAt } from "./frameTree.js";
import { translate, scale } from "./pictureControl.js";
import { initialieKeyCache, keyDownFlags } from "./keyCache.js";
import { JSONEditor } from 'vanilla-jsoneditor'
import { saveCanvas } from "./saveCanvas.js";

let layeredCanvas;
let frameLayer;
let latestJson;

class FrameLayer extends Layer {
    constructor(frameTree) {
        super();
        this.frameTree = frameTree;
    }

    render(canvas, ctx) {
        const size = [canvas.width, canvas.height];
        // render white
        ctx.fillStyle = "rgb(255,255,255)";
        ctx.fillRect(0, 0, size[0], size[1]);

        const layout = calculatePhysicalLayout(this.frameTree, [840, 1188], [0, 0]);
        this.renderElement(ctx, layout);
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
        const layout = calculatePhysicalLayout(this.frameTree, [840, 1188], [0, 0]);
        let layoutlet = findLayoutAt(layout, position);
        if (layoutlet) {
            // calc expansion to longer size
            const scale = Math.max(layoutlet.size[0] / size[0], layoutlet.size[1] / size[1]);
            layoutlet.element.scale = [scale, scale];
            console.log(scale);
            layoutlet.element.image = image;
            this.redraw();
            return true;
        }
        return false;
    }

    accepts(point) {
        const size = [840, 1188];
        const layout = calculatePhysicalLayout(this.frameTree, size, [0, 0]);
        const layoutElement = findLayoutAt(layout, point);
        if (layoutElement && layoutElement.element.image) {
            console.log("accepts");
            return layoutElement;
        }
        return null;
    }

    *pointer(p, layout) {
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
/*                
                if (element.image.width * origin * q[0] < size[0]) {
                    q[0] = size[0] / (element.image.width * origin);
                }
                if (element.image.height * origin * q[1] < size[1]) {
                    q[1] = size[1] / (element.image.height * origin);
                }
*/                
                const s = Math.max(q[0], q[1]);
                element.scale = [origin * s, origin * s];
                this.constraintTranslationAndScale(layout);
                this.redraw(); // TODO: できれば、移動した要素だけ再描画したい
            });
        }
    }

    constraintTranslationAndScale(layout) {
        const element = layout.element;
        const origin = layout.origin;
        const size = layout.size;
        
        if (element.image.width * element.scale[0] < size[0]) {
            element.scale[0] = size[0] / element.image.width;
        }
        if (element.image.height * element.scale[1] < size[1]) {
            element.scale[1] = size[1] / element.image.height;
        }

        const scale = Math.max(element.scale[0], element.scale[1]); // 今のところxとyは同じ
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

function collectImages(frameTree) {
    const images = [];
    if (!frameTree.children || frameTree.children.length === 0) {
        images.push({ 
            image: frameTree.image, 
            scale: frameTree.scale, 
            translation: frameTree.translation 
        });
        console.log(images[images.length - 1]);
    } else {
        for (let i = 0; i < frameTree.children.length; i++) {
            const childImages = collectImages(frameTree.children[i]);
            images.push(...childImages);
        }
    }
    return images;
}

function dealImages(frameTree, images) {
    if (!frameTree.children || frameTree.children.length === 0) {
        if (images.length === 0) { return; }
        const { image, scale, translation } = images.shift();
        frameTree.image = image;
        frameTree.scale = scale;
        frameTree.translation = translation;
    } else {
        for (let i = 0; i < frameTree.children.length; i++) {
            dealImages(frameTree.children[i], images);
        }
    }
}

function markUpChanged(markUp) { // markUp is { json } or { text }
    console.log(markUp);
    let json;
    try {
        // parse json
        if (markUp.json) {
            json = markUp.json;
        } else {
            json = JSON.parse(markUp.text);
        }
    }
    catch (e) {
        // ignore
        const errorArea = document.getElementById("markUpError");
        errorArea.value = e;
    }

    try {
        const images = collectImages(frameLayer.frameTree);
        console.log(images);
        const newFrameTree = FrameElement.compile(json);
        frameLayer.frameTree = newFrameTree;
        dealImages(newFrameTree, images);
        console.log("redraw");
        layeredCanvas.redraw();
        latestJson = json;
    }
    catch(e) {
        console.log(e);
    }
}

export function doIt() {
    const markUp = {
        "margin" : {
            "top": 4,
            "bottom": 4,
            "left": 8,
            "right": 8,
        },
        "width": 180,
        "spacing": 2,
        "column": [
            { "height": 17 },
            { "height": 25, 
              "spacing": 2,
              "row": [
                { "width": 45 },
                { "width": 55 },
              ]
            },
            { "height": 17 }
        ]
    };

    console.log("doIt");

    let canvas = document.getElementById("canvas");
    initialieKeyCache(canvas,
        (code) => {
            return code === "AltLeft" || code === "AltRight" || code === "ControlLeft" || code === "ControlRight";
        });

    const frameTree = FrameElement.compile(markUp);

    // load image from file
    /*
    frameTree.children[0].image  = loadImage("./samples/frame1.png");
    frameTree.children[1].children[0].image  = loadImage("./samples/frame2.png");
    frameTree.children[1].children[1].image  = loadImage("./samples/frame3.png");
    */

    sequentializePointer(FrameLayer);
    layeredCanvas = new LayeredCanvas(canvas);
    frameLayer = new FrameLayer(frameTree);
    layeredCanvas.addLayer(frameLayer);
    layeredCanvas.redraw();

    const editor = new JSONEditor({
        target: document.getElementById('jsoneditor'),
        props: {
            mode: "text",
            content: { json: markUp },
            onChange: (updatedContent, previousContent, { contentErrors, patchResult }) => {
                // content is an object { json: JSONData } | { text: string }
                console.log('onChange', { updatedContent, previousContent, contentErrors, patchResult })
                markUpChanged(updatedContent);
            }
        }
    });

    const saveButton  = document.getElementById("saveButton");
    saveButton.addEventListener("click", saveImage);
}

export function saveImage() {
    saveCanvas(layeredCanvas.canvas, "frame.png", latestJson);
}
