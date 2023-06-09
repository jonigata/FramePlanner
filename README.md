# FramePlanner

マンガの枠組みをツリー構造のデータ(JSON)で定義して、その中で各コマをウィンドウのように扱って絵を配置できるツールです。

https://user-images.githubusercontent.com/128374/224589004-7308540f-bdac-4c15-a70a-c43c59ce5c73.mp4


https://user-images.githubusercontent.com/128374/224721175-9e8bd717-754b-4dea-8010-2421c98683b9.mp4


## 枠線定義JSON

枠線定義jsonは、具体的にはこのような形になっています。
```
{
  "margin": {
    "top": 4,
    "bottom": 4,
    "left": 8,
    "right": 8
  },
  "width": 180,
  "spacing": 2,
  "column": [
    {
      "height": 17
    },
    {
      "height": 25,
      "spacing": 2,
      "row": [
        {
          "width": 45
        },
        {
          "width": 55
        }
      ]
    },
    {
      "height": 17
    }
  ]
}
```

抽象的には、OSのディレクトリのような再帰的な構造になっていて、それぞれのノードは以下のような情報で定義されています。

```
{
  "margin": マージン情報,
  "width": 幅
  "height": 高さ
  "spacing": 子の間隔2,
  "column": 子要素リスト(縦並び)
  "row": 子要素リスト(横並び)
}
```

"width"と"height"、"column"と"row"はどちらかしかありません。
"column"も"row"もないノードはリーフ要素で、あとで絵をドロップして表示したりすることができます。
"margin"、"spacing"は省略可能（0扱い）なので、最小ではこのように
```
        {
          "width": 55
        }
```
widthかheightだけの構造体になります。


widthやheightやmargin、に書かれる「大きさ」要素はすべて「兄弟要素との比」です。兄弟でない要素との比較は意味がありません。例えば、

```
      "row": [
        {"width": 45},
        {"width": 55}
      ]
```
と
```
      "row": [
        {"width": 450},
        {"width": 550}
      ]
```

は全く同じ意味になります。

ただし、左右/上下分割などの操作のspacingのデフォルト値が1なので、それに考慮した値にしておいたほうが多少ラクです。

### 学び方

とりあえず、左のjsonエディタのTREEと書かれたボタン
![TREE](/docs/doc1.png)
を押して、適当な配列要素をDUPLICATEしてみるところから始めると良いでしょう。

### ギャラリー

後ほど枠線ギャラリーを作る予定です。サンプルがほしいのでいいものができたら
[Issues](https://github.com/jonigata/FramePlanner/issues/1)
にjsonを貼り付けておいてください。

## 画像配置

リーフ要素（紙面上でコマになっている部分）には、画像をdropすることができます。ドロップ後は、Alt+ドラッグで移動、Ctrl+ドラッグ（左右）で拡大縮小がでできます。ドロップ時に画像の大きさがコマの大きさに足りない場合自動で拡大し、拡大縮小や移動では余白が出るような操作はできません。

## セーブ

左下のSaveボタンを押してください。



