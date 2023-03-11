export class LayeredCanvas {
    constructor(c) {
        console.log("initializeLayeredCanvas");
        this.canvas = c;
        this.context = canvas.getContext('2d');
        console.log([this.canvas.width, this.canvas.height]);

        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.addEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.addEventListener('drop', this.handleDrop.bind(this));

        this.layers = [];
    }

    cleanup() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.removeEventListener('mouseup', this.handleMouseUp.bind(this));
        document.removeEventListener('mouseleave', this.handleMouseLeave.bind(this));
        this.canvas.removeEventListener('dragover', this.handleDragOver.bind(this));
        this.canvas.removeEventListener('drop', this.handleDrop.bind(this));
    }

    getCanvasSize() {
        return [this.canvas.width, this.canvas.height];
    }
    
    getCanvasPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor(event.clientX - rect.left);
        const y = Math.floor(event.clientY - rect.top);
        return [x, y];
    }
    
    handleMouseDown(event) {
        const p = this.getCanvasPosition(event);
      
        for (let i = this.layers.length - 1; i >= 0; i--) {
            const layer = this.layers[i];
            this.payload = layer.accepts(p);
            if (this.payload) {
                layer.mouseDown(p, this.payload);
                this.draggingLayer = layer;
                this.dragStart = p;
                break;
            }
        }
        this.redrawIfRequired();
    }
      
    handleMouseMove(event) {
        this.mouseCursor = this.getCanvasPosition(event);
        if (this.draggingLayer) {
            this.draggingLayer.mouseMove(this.getCanvasPosition(event), this.payload); // 念のため別の実体
        }
        this.redrawIfRequired();
    }
    
    handleMouseUp(event) {
        if (this.draggingLayer) {
            this.draggingLayer.mouseUp(this.getCanvasPosition(event), this.payload);
            this.draggingLayer = null;
        }
        this.redrawIfRequired();
    }
      
    handleMouseLeave(event) {
        this.mouseCursor = [-1,-1];
        if (this.draggingLayer) {
            this.handleMouseUp(event);
        }
        this.redrawIfRequired();
    }

    handleDragOver(event) {
        event.preventDefault();
    }

    handleDrop(event) {
        event.preventDefault();  // ブラウザのデフォルトの画像表示処理をOFF
        var file = event.dataTransfer.files[0];

        if (!file.type.match(/^image\/(png|jpeg|gif)$/)) return;

        var image = new Image();
        var reader = new FileReader();

        reader.onload = (e) => {
            image.onload = () => {
                console.log("image loaded", image.width, image.height);
                for (let i = this.layers.length - 1; i >= 0; i--) {
                    const layer = this.layers[i];
                    if (layer.dropped(image, this.mouseCursor)) {
                        this.redrawIfRequired();
                        break;
                    }
                }
            };
            image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
      
    render() {
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            layer.render(this.canvas, this.context);
        }
    }

    redraw() {
        this.render();
    }
    
    redrawIfRequired() {
        for (let i = 0; i < this.layers.length; i++) {
            const layer = this.layers[i];
            if (layer.redrawRequired) {
                for (let j = i ; j < this.layers.length; j++) {
                    this.layers[j].redrawRequired = false;
                }
                this.render();
                return;
            }
        }
    }
    
    addLayer(layer) {
        this.layers.push(layer);
    }
    
}


let mouseSequence = { // mixin
    mouseDown(p, payload) {
        console.log("mouseDown", p)
        this.mouseHandler = this.mouse(p, payload);
    },
    mouseMove(p, payload) {
        if (this.mouseHandler) {
            this.mouseHandler.next(p);
        }
    },
    mouseUp(p, payload) {
        if (this.mouseHandler) {
            this.mouseHandler.next(null);
            this.mouseHandler = null;
        }
    },
/*
    sample mouse handler
    *mouse(p) {
        while (p = yield) {
            console.log("mouse", p);
        }
    }
*/
};

export function sequentializeMouse(layerClass) {
    layerClass.prototype.mouseDown = mouseSequence.mouseDown;
    layerClass.prototype.mouseMove = mouseSequence.mouseMove;
    layerClass.prototype.mouseUp = mouseSequence.mouseUp;
}

export class Layer {
    constructor() {}

    redraw() { this.redrawRequired = true; }

    accepts(point) { return null; }
    mouseDown(point, payload) { console.log("A");}
    mouseMove(point, payload) {}
    mouseUp(point, payload) {}
    render(canvas, ctx) {}
    dropped(image, position) { return false; }
}