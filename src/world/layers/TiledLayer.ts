///<amd-module name="world/layers/TiledLayer" />

import Kernel = require('../Kernel');
import Extent = require('../Extent');
import GraphicGroup = require('../GraphicGroup');
import SubTiledLayer = require('./SubTiledLayer');
import Camera from '../Camera';
import Tile = require("../graphics/Tile");
import TileGrid = require('../TileGrid');
import Utils = require('../Utils');

abstract class TiledLayer extends GraphicGroup<SubTiledLayer> {

  constructor() {
    super();

    //添加第0级的子图层
    var subLayer0 = new SubTiledLayer(0);
    this.add(subLayer0);

    //要对level为1的图层进行特殊处理，在创建level为1时就创建其中的全部的四个tile
    var subLayer1 = new SubTiledLayer(1);
    this.add(subLayer1);

    for (var m = 0; m <= 1; m++) {
      for (var n = 0; n <= 1; n++) {
        var args = {
          level: 1,
          row: m,
          column: n,
          url: ""
        };
        args.url = this.getTileUrl(args.level, args.row, args.column);
        var tile = Tile.getInstance(args.level, args.row, args.column, args.url);
        subLayer1.add(tile);
      }
    }
  }

  refresh(lastLevel: number, lastLevelTileGrids: TileGrid[]) {
    this._updateSubLayerCount(lastLevel);

    var levelsTileGrids: TileGrid[][] = [];
    var parentTileGrids = lastLevelTileGrids;
    var subLevel: number;

    for (subLevel = lastLevel; subLevel >= 2; subLevel--) {
      levelsTileGrids[subLevel] = parentTileGrids;//此行代码表示第subLevel层级的可见切片
      parentTileGrids = parentTileGrids.map(function (item) {
        return item.getParent();
      });
      parentTileGrids = Utils.filterRepeatArray(parentTileGrids);
    }

    console.log("----------------------------------------------------------");

    for (subLevel = 2; subLevel <= lastLevel; subLevel++) {
      var addNew = lastLevel === subLevel || (lastLevel - subLevel) > 2;
      this.children[subLevel].updateTiles(levelsTileGrids[subLevel], addNew);
    }
  }

  onDraw(camera: Camera) {
    var program = Tile.findProgram();
    if (!program) {
      return;
    }
    program.use();
    var gl = Kernel.gl;

    //设置uniform变量的值
    //uPMVMatrix
    var pmvMatrix = camera.getProjViewMatrixForDraw();
    var locPMVMatrix = program.getUniformLocation('uPMVMatrix');
    gl.uniformMatrix4fv(locPMVMatrix, false, pmvMatrix.getFloat32Array());

    //uSampler
    gl.activeTexture(gl.TEXTURE0);
    var locSampler = program.getUniformLocation('uSampler');
    gl.uniform1i(locSampler, 0);


    //此处将深度测试设置为ALWAYS是为了解决两个不同层级的切片在拖动时一起渲染会导致屏闪的问题
    gl.depthFunc(gl.ALWAYS);
    super.onDraw(camera);
    //将深度测试恢复成LEQUAL
    gl.depthFunc(gl.LEQUAL);
  }

  add(subTiledLayer: SubTiledLayer) {
    super.add(subTiledLayer);
    subTiledLayer.tiledLayer = this;
  }

  getExtent(level?: number) {
    var extents = this.getExtents(level);
    return Extent.union(extents);
  }

  getExtents(level?: number): Extent[] {
    if (!(level >= 0 && level <= (this.children.length - 1))) {
      level = this.children.length - 1 - 3;
    }
    var subTiledLayer = this.children[level];
    if (subTiledLayer) {
      return subTiledLayer.getExtents();
    }
    return [];
  }

  protected wrapUrlWithProxy(url: string): string {
    if (Kernel.proxy) {
      return Kernel.proxy + "?" + url;
    }
    return url;
  }

  //根据切片的层级以及行列号获取图片的url,抽象方法，供子类实现
  abstract getTileUrl(level: number, row: number, column: number): string

  //根据传入的level更新SubTiledLayer的数量
  private _updateSubLayerCount(level: number) {
    var subLayerCount = this.children.length;
    var deltaLevel = level + 1 - subLayerCount;
    var i: number, subLayer: SubTiledLayer;
    if (deltaLevel > 0) {
      //需要增加子图层
      for (i = 0; i < deltaLevel; i++) {
        subLayer = new SubTiledLayer(i + subLayerCount);
        this.add(subLayer);
      }
    } else if (deltaLevel < 0) {
      //需要删除多余的子图层
      deltaLevel *= -1;
      for (i = 0; i < deltaLevel; i++) {
        var removeLevel = this.children.length - 1;
        //第0级和第1级不删除
        if (removeLevel >= 2) {
          subLayer = this.children[removeLevel];
          this.remove(subLayer);
        } else {
          break;
        }
      }
    }
  }
}

export = TiledLayer;