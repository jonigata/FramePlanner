import { LayeredCanvas, Layer, sequentializePointer } from "./layeredCanvas.js";
import { keyDownFlags } from "./keyCache.js";
import ImageTracer from "./imagetracer_v1.2.6.js";

export class BalloonLayer extends Layer {
    constructor() {
        super();
        this.balloons = [];
    }

    render(ctx) {
        // drawCanvasの内容をレイヤーとしてcanvasに描画
        // アルファ値を考慮するために、drawImageを使う
        if (this.drawCanvas) {
            ctx.drawImage(this.drawCanvas, 0, 0);
        }

        // バルーンを描画
        for (let balloon of this.balloons) {
            ctx.drawImage(balloon, 0, 0);
        }
    }

    accepts(point) {
        console.log("accepts", keyDownFlags["KeyF"]);
        if (keyDownFlags["KeyF"]) {
            return true;
        }
        return null;
    }

    *pointer(p) {
        // キャンバスと同じ大きさの描画用Canvasを作成
        this.drawCanvas = document.createElement("canvas");
        this.drawCanvas.width = this.canvas.width;
        this.drawCanvas.height = this.canvas.height;
        this.drawCanvasCtx = this.drawCanvas.getContext("2d");

        // 描画用キャンバスを透明に
        this.drawCanvasCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);

        // デバッグ用にdrawCanvasを表示
/*
        this.drawCanvas.style.position = "absolute";
        this.drawCanvas.style.top = "0px";
        this.drawCanvas.style.left = "0px";
        this.drawCanvas.style.zIndex = "100";
        document.body.appendChild(this.drawCanvas);
*/

        while (p = yield) {
            // ブラシの用にdrawCanvasに円を描画
            this.drawCanvasCtx.beginPath();
            this.drawCanvasCtx.arc(p[0], p[1], 20, 0, Math.PI * 2, false);
            this.drawCanvasCtx.fillStyle = "rgba(255, 0, 0, 0.7)";
            this.drawCanvasCtx.fill();
            this.drawCanvasCtx.closePath();
            this.redraw();
        }

        // 縮小表示用のcanvas
        const shrinkRatio = 10;
        let shrinkCanvas = document.createElement("canvas");
        shrinkCanvas.width = this.drawCanvas.width / shrinkRatio;
        shrinkCanvas.height = this.drawCanvas.height / shrinkRatio;
        let shrinkCtx = shrinkCanvas.getContext("2d");
        shrinkCtx.drawImage(this.drawCanvas, 0, 0, shrinkCanvas.width, shrinkCanvas.height);

        var imgd = ImageTracer.getImgdata(shrinkCanvas);
        var svg = ImageTracer.imagedataToSVG(imgd, { ltres:0, qtres:100, linefilter:true, rightangleenhance:false, scale:shrinkRatio });
        console.log(svg);
        
        const tracedata = ImageTracer.imagedataToTracedata(
            imgd,
            { ltres:0.1, qtres:1, scale:10 }
        );
        
        console.log( JSON.stringify( tracedata, null, 2 ));
    

        let blob = new Blob([svg], {type: 'image/svg+xml'});
        let url = URL.createObjectURL(blob);
        let image = new Image();
        image.src = url;
        image.addEventListener('load', () => URL.revokeObjectURL(url), {once: true});

        // this.canvasに重ねて表示
        this.balloons.push(image);

        this.drawCanvas = null;
        this.drawCanvasCtx = null;
    }
}

