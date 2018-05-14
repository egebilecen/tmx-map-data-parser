//=============================================================================
// TMX File Parser v1.0 (Based on Tiled Map Editor)
// ----------------------------------------------------------------------------
// Author : Ege Bilecen
// Website: egebilecen.info
// ----------------------------------------------------------------------------
// Required scripts: jQuery
// ----------------------------------------------------------------------------
// Notes:
// 1. Render order is static and starting from "Left Up".
//=============================================================================
var TMX_Parser = {
    //-Functions
    init : function(canvas,_debug){
        if(_debug === null || typeof _debug === "undefined" || typeof _debug !== "boolean") _debug = false;
        this.settings["ctx"]   = canvas.getContext("2d");
        this.settings["debug"] = _debug; 
        return;
    },
    load : function(filePath, tilesetDirPath, _autoRun){
        if(_autoRun === null || typeof _autoRun === "undefined" || typeof _autoRun !== "boolean") _autoRun = false;
        $.ajax({
            url  : filePath,
            type : "get",
            dataType : "text",
            success  : function(data){
                var VdZcW = filePath.split("/");
                var lHWIj = VdZcW[VdZcW.length - 1].split(".");

                var pureName = lHWIj[lHWIj.length - 2];
                var name     = VdZcW[VdZcW.length - 1];
                var path     = filePath;
                var status   = 1;

                TMX_Parser.file.all[pureName] = {
                    pureName : pureName,
                    name     : name,
                    path     : path,
                    data     : data,
                    status   : status
                };
                
                TMX_Parser.watcher.all.tilesets.baseDir = tilesetDirPath;
                
                if(_autoRun)
                {
                    if(TMX_Parser.watcher.switchFile(pureName))
                        TMX_Parser.run();
                    else console.log("!!! - TMX Parser - File for switching is not found! ("+pureName+")");
                }
            },
            error    : function(){
                console.log("!!! - TMX Parser - Cannot load file ("+filePath+").");
            }
        });
    },
    run : function(){
        var FILE = this.file.all[this.watcher.all.file.pureName];
        if( FILE.status === 1 )
        {
            if(this.settings.debug) console.log("??? - TMX Parser - Starting to parsing.");

            //-Reset watcher
            this.watcher.reset();

            var xmlData      = new DOMParser().parseFromString(FILE.data,"text/xml").getElementsByTagName("map")[0];
            this.information[FILE.pureName] = {};
            FILE["xml"] = xmlData;

            //-Orientation
            this.information[FILE.pureName]["orientation"] = xmlData.getAttribute("orientation");

            //-Render Order
            this.information[FILE.pureName]["renderOrder"] = xmlData.getAttribute("renderorder");

            //-Map Width (Tile)
            this.information[FILE.pureName]["mapWidth"]    = parseInt(xmlData.getAttribute("width"));

            //-Map Height (Tile)
            this.information[FILE.pureName]["mapHeight"]   = parseInt(xmlData.getAttribute("height"));

            //-Tile Width
            this.information[FILE.pureName]["tileWidth"]   = parseInt(xmlData.getAttribute("tilewidth"));

            //-Tile Height
            this.information[FILE.pureName]["tileHeight"]  = parseInt(xmlData.getAttribute("tileheight"));

            //------------------------------------------------------------------------//

            //-Tilesets
            var tilesets = xmlData.getElementsByTagName("tileset");
            this.tilesets.all[FILE.pureName] = {};
            this.watcher.all.tilesets.totalCount = tilesets.length;

            for( var _i=0; _i < tilesets.length; _i++ )
            {
                var tileset = tilesets[_i];

                //-Tileset's attributes
                var tilesetFirst_gId  = parseInt(tileset.getAttribute("firstgid"));
                var tilesetName       = tileset.getAttribute("name");
                var tilesetTileWidth  = parseInt(tileset.getAttribute("tilewidth"));
                var tilesetTileHeight = parseInt(tileset.getAttribute("tileheight"));
                var tilesetTileCount  = parseInt(tileset.getAttribute("tilecount"));

                //-Create tileset on this.tilesets
                this.tilesets.all[FILE.pureName][tilesetName] = {
                    name         : tilesetName,
                    firstgid     : tilesetFirst_gId,
                    tileWidth    : tilesetTileWidth,
                    tileHeight   : tilesetTileHeight,
                    tilesetCount : tilesetTileCount,
                    img          : null, //Image() object
                    source       : null,
                    status       : 0 // 0: not loaded, 1: loaded
                };

                var orginalImg = tileset.getElementsByTagName("image")[0];
                
                var source = orginalImg.getAttribute("source").split("/");
                source     = source[source.length - 1];
                
                var img    = new Image();
                img.src    = TMX_Parser.watcher.all.tilesets.baseDir + source;
                img.setAttribute("data-name",tilesetName);
                img.onload = function(){
                    var _imgName = this.getAttribute("data-name");
                    TMX_Parser.tilesets.all[FILE.pureName][_imgName].img    = this;
                    TMX_Parser.tilesets.all[FILE.pureName][_imgName].source = this.src;
                    TMX_Parser.tilesets.all[FILE.pureName][_imgName].status = 1;
                    TMX_Parser.tilesets.loaded();
                }
            }

        }   
        else console.log("!!! - TMX Parser - Please load a file.");
    },

    //-Objects
    settings : {},
    tilesets : {
        which : function(tileId){
            for( var tilesetName in this.all[TMX_Parser.watcher.all.file.pureName] )
            {
                if(!this.all[TMX_Parser.watcher.all.file.pureName].hasOwnProperty(tilesetName)) continue;

                var tileset = this.all[TMX_Parser.watcher.all.file.pureName][tilesetName];

                if( tileId >= tileset.firstgid && tileId <= ((tileset.tilesetCount - 1) + tileset.firstgid) )
                    return tileset;
            }
        },
        loaded : function(){
            TMX_Parser.watcher.all.tilesets.currentCount++;
            if( TMX_Parser.watcher.all.tilesets.currentCount === TMX_Parser.watcher.all.tilesets.totalCount )
            {
                if(TMX_Parser.settings.debug) console.log("??? - TMX Parser - All tilesets loaded. ("+TMX_Parser.watcher.all.tilesets.currentCount+"/"+TMX_Parser.watcher.all.tilesets.totalCount+")");
                TMX_Parser.layers.startRendering();
            }

            //-Create event
            var event = document.createEvent("Event");
            event.initEvent("TMX_Parser_tileset_loaded");
            event.information = { totalTileset : TMX_Parser.watcher.all.tilesets.totalCount, loadedTileset : TMX_Parser.watcher.all.tilesets.currentCount };
            document.dispatchEvent(event);
        },
        all : {}
    },
    layers : {
        startRendering : function(){
            if(TMX_Parser.settings.debug) console.log("??? - TMX Parser - Starting to rendering layer datas.");
            
            //-Layers
            var layers = TMX_Parser.file.all[TMX_Parser.watcher.all.file.pureName].xml.getElementsByTagName("layer");

            TMX_Parser.layers.all[TMX_Parser.watcher.all.file.pureName] = {};

            for( var _i=0; _i < layers.length; _i++ )
            {
                var layer = layers[_i];

                //-Layer's attributes
                var layerName   = layer.getAttribute("name");
                var layerWidth  = parseInt(layer.getAttribute("width")); //tile
                var layerHeight = parseInt(layer.getAttribute("height")); //tile

                //-Render Layer's Matrix
                var layerBadData = layer.getElementsByTagName("data")[0].innerHTML.trim().split(",").map(function(id){
                    return parseInt(id);
                });

                //-Re-edit Bad Layer Data
                var lastIndex     = 0;
                var layerGoodData = [];
                for( var _j=0; _j < layerBadData.length / TMX_Parser.information[TMX_Parser.watcher.all.file.pureName].mapWidth; _j++ )
                {
                    var croppedData = layerBadData.slice(lastIndex,lastIndex+TMX_Parser.information[TMX_Parser.watcher.all.file.pureName].mapWidth);
                    layerGoodData.push(croppedData);
                    lastIndex = lastIndex + TMX_Parser.information[TMX_Parser.watcher.all.file.pureName].mapWidth;
                }

                TMX_Parser.layers.all[TMX_Parser.watcher.all.file.pureName][layerName] = {
                    name   : layerName,
                    width  : parseInt(layerWidth),
                    height : parseInt(layerHeight),
                    data   : layerGoodData
                };
            }
            if(TMX_Parser.settings.debug) console.log("??? - TMX Parser - All layer datas rendered. For draw them on canvas, please run \"TMX_Parser.layers.draw()\" function.");
        },
        draw : function(){
            if(TMX_Parser.settings.debug) console.log("??? - TMX Parser - Drawing layers to the canvas.");
            
            for( var layerName in TMX_Parser.layers.all[TMX_Parser.watcher.all.file.pureName] )
            {
                if(!TMX_Parser.layers.all[TMX_Parser.watcher.all.file.pureName].hasOwnProperty(layerName)) continue;

                var layer = TMX_Parser.layers.all[TMX_Parser.watcher.all.file.pureName][layerName];

                for( var h=0; h < layer.data.length; h++ )
                {
                    for( var w=0; w < layer.data[h].length; w++ )
                    {
                        if(layer.data[h][w] === 0) continue;

                        var tileset     = TMX_Parser.tilesets.which(layer.data[h][w]); //return: tileset
                        var limitPerRow = tileset.img.width / tileset.tileWidth;
                        var posWidth    = layer.data[h][w] - tileset.firstgid;
                        var posHeight   = 0;

                        if( posWidth > limitPerRow )
                        {
                            posHeight = posHeight + Math.floor(posWidth / limitPerRow);
                            posWidth  = posWidth % limitPerRow;
                        }

                        TMX_Parser.settings.ctx.beginPath();
                        TMX_Parser.settings.ctx.drawImage(
                            tileset.img, //img
                            posWidth * tileset.tileWidth, posHeight * tileset.tileHeight, //start crop x, start crop y
                            tileset.tileWidth,tileset.tileHeight, //clipped img width, clipped img height
                            w * tileset.tileWidth, h * tileset.tileHeight, //draw pos. x, draw pos. y
                            tileset.tileWidth, tileset.tileHeight //img width, img height (optinal)
                        );
                        TMX_Parser.settings.ctx.closePath();
                    }
                }
            }
        },
        all : {}
    },
    watcher  : {
        all : {
            tilesets : {
                totalCount   : 0,
                currentCount : 0,
                baseDir      : null
            },
            file : {
                pureName : null
            }
        },
        reset : function(){
            //-Tilesets
            this.all.tilesets.totalCount   = 0;
            this.all.tilesets.currentCount = 0;
        },
        switchFile : function(filePureName){
            if(TMX_Parser.file.all.hasOwnProperty(filePureName))
            {
                this.all.file.pureName = filePureName;
                return true;
            }
            else return false;
        }
    },

    //-Variables
    file : { //file that will be parsed
        all : {},
        // name : null,
        // data : null,
        // status : 0 // 0: not loaded, 1: loaded
    },
    information : {} //gives general information
};
