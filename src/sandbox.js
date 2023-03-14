import { LayeredCanvas, sequentializePointer } from "./layeredCanvas.js";
import { FrameLayer } from "./frameLayer.js";
import { FrameElement } from "./frameTree.js";
import { initialieKeyCache } from "./keyCache.js";
import { JSONEditor } from 'vanilla-jsoneditor'
import { saveCanvas } from "./saveCanvas.js";
import { drawTemplate } from "./frameTemplate.js";
import Swiper, { Navigation, Pagination } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

let layeredCanvas;
let frameLayer;
let latestJson;
let skipJsonChange = false;

function collectImages(frameTree) {
    const images = [];
    if (!frameTree.children || frameTree.children.length === 0) {
        images.push({ 
            image: frameTree.image, 
            scale: frameTree.scale, 
            translation: frameTree.translation 
        });
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
        const newFrameTree = FrameElement.compile(json);
        frameLayer.frameTree = newFrameTree;
        dealImages(newFrameTree, images);
        layeredCanvas.redraw();
        latestJson = json;
    }
    catch(e) {
        console.log(e);
    }
}

function JSONstringifyOrder(obj, space)
{
    const allKeys = new Set();
    JSON.stringify(obj, (key, value) => (allKeys.add(key), value));
    return JSON.stringify(obj, Array.from(allKeys).sort(), space);
}

export function doIt() {
    const markUps = [
        {
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
        },
        { 
            "margin" : {
                "top": 4,
                "bottom": 4,
                "left": 4,
                "right": 4,
            },
            "width": 180,
            "column": [
                {
                    height: 180
                }
            ]
        },
        {
            "margin": {
                "top": 1,
                "bottom": 1,
                "left": 2,
                "right": 2
            },
            "width": 3,
            "spacing": 1,
            "column": [
                {
                    "height": 8
                },
                {
                    "height": 8
                },
                {
                    "height": 8
                },
                {
                    "height": 8
                }
            ]
        }        
];


    console.log("doIt");

    let canvas = document.getElementById("canvas");
    initialieKeyCache(canvas,
        (code) => {
            return code === "AltLeft" || code === "AltRight" ||
                code === "ControlLeft" || code === "ControlRight" ||
                code === "KeyQ" || code === "KeyW" || code === "KeyS";
        });

    const frameTree = FrameElement.compile(markUps[0]);
    // const mu = FrameElement.decompile(frameTree);
    // console.log(JSON.stringify(mu, null, 2));

    /*
    // load image from file
    frameTree.children[0].image  = loadImage("./samples/frame1.png");
    frameTree.children[1].children[0].image  = loadImage("./samples/frame2.png");
    frameTree.children[1].children[1].image  = loadImage("./samples/frame3.png");
    */

    sequentializePointer(FrameLayer);
    layeredCanvas = new LayeredCanvas(canvas);
    frameLayer = new FrameLayer(
        frameTree,
        (frameTree) => {
            const markUp = FrameElement.decompile(frameTree);
            skipJsonChange = true;
            editor.set({ text: JSONstringifyOrder(markUp, 2) });
            skipJsonChange = false;

            frameLayer.constraintAll();
        });
    layeredCanvas.addLayer(frameLayer);
    layeredCanvas.redraw();
    latestJson = markUps[0];

    const editor = new JSONEditor({
        target: document.getElementById('jsoneditor'),
        props: {
            mode: "text",
            content: { text: JSONstringifyOrder(markUps[0], 2) },
            onChange: (updatedContent, previousContent, { contentErrors, patchResult }) => {
                // content is an object { json: JSONData } | { text: string }
                console.log('onChange', { updatedContent, previousContent, contentErrors, patchResult })
                if (!skipJsonChange) { // あまり信用しないように
                    markUpChanged(updatedContent);
                }
            }
        }
    });

    const saveButton  = document.getElementById("saveButton");
    saveButton.addEventListener("click", saveImage);

    let markUpIndex = 0;
    for (let slideCanvas of document.getElementsByClassName("swiper-slide-canvas")) {
        drawTemplate(slideCanvas, markUps[markUpIndex++]);
    }

    const swiper = new Swiper('.swiper', {
        // Optional parameters
        modules: [Navigation, Pagination],
        direction: 'horizontal',
        loop: true,

        // If we need pagination
        pagination: {
            el: '.swiper-pagination',
        },

        // Navigation arrows
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
    });        

    document.getElementById('load-frame-template').addEventListener(
        'click', () => {
            const markUp = markUps[swiper.realIndex];
            markUpChanged({ json: markUp });
        }
    )
}

export function saveImage() {
    saveCanvas(layeredCanvas.canvas, "frame.png", latestJson);
}

export function setCanvasSize(w, h) {
    layeredCanvas.setCanvasSize(w, h);
    layeredCanvas.redraw();
}
