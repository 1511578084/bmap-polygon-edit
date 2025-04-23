let pointSize = 6

function tp({ lat, lng }) {
  // 如果是百度墨卡托米制坐标,需要转一下
  if (lat > 90 && lng > 180) {
    const mcPoint = new BMapGL.Point(lng, lat)
    const point = BMapGL.Projection.convertMC2LL(mcPoint)
    return new BMapGL.Point(point.lng, point.lat)
  }
  return new BMapGL.Point(lng, lat)
}
function transferPoint(point) {
  // 获取百度坐标
  const { lat, lng, latLng } = point
  if (latLng) return tp(latLng)
  return tp({ lat, lng })
}

function cMouseDown(e) {
  const map = this.map
  const pxs = this.__pxs
  const x = e.offsetX
  const y = e.offsetY

  // 判断落点在哪个点上
  this.__currentIdx = null
  for (let i = pxs.length - 1; i >= 0; i--) {
    const point = pxs[i]
    const xs = point.x - pointSize
    const xe = point.x + pointSize
    const ys = point.y - pointSize
    const ye = point.y + pointSize

    if (x >= xs && x <= xe && y >= ys && y <= ye) {
      if (i === pxs.length - 1) {
        this.__currentIdx = 0
      } else {
        this.__currentIdx = i
      }
      break
    }
  }
  // 落在节点上就禁止拖动
  if (typeof this.__currentIdx === 'number') {
    map.disableDragging()
    this.__canvas.style.zIndex = 5
  } else {
    map.enableDragging()
    this.__canvas.style.zIndex = 3
  }
}

function cMouseMove(e) {
  // 落在点上
  if (typeof this.__currentIdx === 'number') {
    const map = this.map
    const pxs = this.__pxs
    const x = e.offsetX
    const y = e.offsetY
    const isReal = this.__currentIdx % 2 === 0
    if (isReal) {
      // 是实点，更新该实点的坐标位置
      const realIdx = pxs[this.__currentIdx].realIdx
      this.__drawPolygon.setPositionAt(realIdx, map.pixelToPoint(new BMapGL.Pixel(x, y)))
      if (this.__currentIdx === 0 && pxs[0].equals(pxs[pxs.length - 1])) {
        // 首尾点一致，同时更新尾点
        this.__drawPolygon.setPositionAt(pxs[pxs.length - 1].realIdx, map.pixelToPoint(new BMapGL.Pixel(x, y)))
      }
      renderCanvas.bind(this)()
    } else {
      // 是虚点，插入两个
      renderCanvas.bind(this)(true, { x, y, realIdx: pxs[this.__currentIdx - 1].realIdx })
    }
  }
}

function cMouseUp(e) {
  this.__canvas.style.zIndex = 3
  if (typeof this.__currentIdx === 'number') {
    const polygon = this
    const map = this.map
    const pxs = this.__pxs
    // 如果是虚点，要去更新多边形的路径
    const isSham = this.__currentIdx % 2 !== 0
    const points = polygon.__drawPolygon.getPoints().map(transferPoint)
    if (isSham) {
      const x = e.offsetX
      const y = e.offsetY
      const realIdx = pxs[this.__currentIdx - 1].realIdx
      points.splice(realIdx + 1, 0, map.pixelToPoint(new BMapGL.Pixel(x, y)))
      polygon.__drawPolygon.setPath(points)
      renderCanvas.bind(this)()
    }
    polygon.setPath(points)
    polygon.__currentIdx = null
    this.dispatchEvent('lineupdate', { target: this, custom: true })
    map.enableDragging()
  }
}

function hexToRgba(hex, opacity = 1) {
  const isShort = hex.length === 3
  const matchs = hex.substr(1).match(new RegExp(`(\\S{${isShort ? 1 : 2}})`, 'g'))
  if (!matchs) return ''
  return `rgba(${parseInt(matchs[0], 16)}, ${parseInt(matchs[1], 16)}, ${parseInt(matchs[2], 16)}, ${opacity})`
}

function renderCanvas(isSham, shamInfo) {
  const polygon = this
  const map = polygon.map
  const cvSize = map.getSize()
  // 获取路径点
  const points = polygon.__drawPolygon.getPoints().map(transferPoint)
  let pxs = points.map(point => map.pointToPixel(point))
  // 转换为像素位置
  const ctx = polygon.__canvas.getContext('2d')
  ctx.clearRect(0, 0, cvSize.width, cvSize.height)
  // 画多边形
  const { fillColor, fillOpacity, strokeColor, strokeOpacity, strokeWeight } = polygon.__polyOptions
  ctx.beginPath()
  ctx.lineWidth = strokeWeight
  ctx.moveTo(pxs[0].x, pxs[0].y)
  pxs.forEach((point, i) => {
    // 虚点拖动时，要将虚点插入
    if (typeof isSham === 'boolean' && shamInfo && shamInfo.realIdx + 1 === i) {
      const { x, y } = shamInfo
      ctx.lineTo(x, y)
      ctx.lineTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  })
  ctx.closePath()
  ctx.fillStyle = hexToRgba(fillColor, fillOpacity)
  ctx.strokeStyle = hexToRgba(strokeColor, strokeOpacity)
  ctx.fill()
  ctx.stroke()
  // 画实点和虚点
  // 拆入虚点
  pxs = pxs.reduce((pre, item, i) => {
    // 存储在points中的真实位置
    item.realIdx = i
    const next = points[i + 1]
    if (next) {
      let shamNode = null
      // 如果拖动了虚点，则虚点的位置不再通过计算获得
      if (typeof isSham === 'boolean' && shamInfo && shamInfo.realIdx === i) {
        const { x, y } = shamInfo
        shamNode = new BMapGL.Pixel(x, y)
      } else {
        const cur = points[i]
        const center = {
          lat: (cur.lat + next.lat) / 2,
          lng: (cur.lng + next.lng) / 2
        }
        shamNode = map.pointToPixel(new BMapGL.Point(center.lng, center.lat))
      }
      return pre.concat([item, shamNode])
    }
    return pre.concat(item)
  }, [])
  ctx.beginPath()
  ctx.lineWidth = 1
  pxs.forEach((point, i) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - (i % 2)})`
    ctx.fillRect(point.x - pointSize, point.y - pointSize, pointSize * 2, pointSize * 2)
    ctx.fill()
    ctx.strokeRect(point.x - pointSize, point.y - pointSize, pointSize * 2, pointSize * 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 1)'
    ctx.stroke()
  })
  ctx.closePath()
  polygon.__pxs = pxs
}

function customEdit(polygon) {
  const map = polygon.map
  // 创建canvas层
  const container = map.getContainer()
  const cSize = map.getContainerSize()
  const cvSize = map.getSize()
  const canvas = document.createElement('canvas')
  canvas.width = cvSize.width
  canvas.height = cvSize.height
  canvas.style.position = 'absolute'
  canvas.style.left = 0
  canvas.style.top = 0
  canvas.style.zIndex = 3
  canvas.style.width = cSize.width + 'px'
  canvas.style.height = cSize.height + 'px'
  container.appendChild(canvas)
  polygon.__canvas = canvas
  // 创建替身多边形，用来存储中间数据，否则会频繁触发多边形更新事件
  const points = polygon.getPoints()
  const polyOptions = {
    fillColor: polygon.getFillColor(),
    fillOpacity: polygon.getFillOpacity(),
    strokeColor: polygon.getStrokeColor(),
    strokeOpacity: polygon.getStrokeOpacity(),
    strokeWeight: polygon.getStrokeWeight()
  }

  const polyline = points.map(transferPoint).map(item => new BMapGL.Point(item.lng, item.lat))
  const drawPolygon = new BMapGL.Polygon(polyline)
  const bindRenderCanvas = renderCanvas.bind(polygon)
  polygon.__polyOptions = polyOptions
  polygon.__drawPolygon = drawPolygon
  const originSetPath = polygon.setPath
  polygon.setPath = function(points) {
    if (this.__drawPolygon) {
      this.__drawPolygon.setPath(points)
      bindRenderCanvas()
    }
    originSetPath.call(this, points)
  }
  // 绑定事件
  map.addEventListener('zooming', bindRenderCanvas)
  map.addEventListener('moving', bindRenderCanvas)
  map.addEventListener('dragging', bindRenderCanvas)

  bindRenderCanvas()
  const bindMouseDown = cMouseDown.bind(polygon)
  const bindMouseMove = cMouseMove.bind(polygon)
  const bindMouseUp = cMouseUp.bind(polygon)
  const bindContextMenu = function(e) {
    bindMouseDown(e)
    if (typeof polygon.__currentIdx === 'number') {
      const isReal = polygon.__currentIdx % 2 === 0
      if (isReal) {
        // 删除该点
        const pxs = polygon.__pxs
        const realIdx = pxs[polygon.__currentIdx].realIdx
        const points = polygon.getPoints().map(transferPoint)
        points.splice(realIdx, 1)
        if (polygon.__currentIdx === 0 && pxs[0].equals(pxs[pxs.length - 1])) {
          // 首尾点一致，同时更新尾点
          points.pop()
          points.push(points[0].clone())
        }

        polygon.setPath(points)
      }

      map.enableDragging()
      polygon.__currentIdx = null
    }
  }
  container.addEventListener('mousedown', bindMouseDown)
  container.addEventListener('mousemove', bindMouseMove)
  container.addEventListener('mouseup', bindMouseUp)
  container.addEventListener('contextmenu', bindContextMenu)
  polygon.__disableEditing = function() {
    polygon.__disableEditing = undefined
    polygon.__canvas = undefined
    polygon.__pxs = undefined
    polygon.__drawPolygon = undefined
    polygon.__polyOptions = undefined
    container.removeChild(canvas)
    map.removeEventListener('zooming', bindRenderCanvas)
    map.removeEventListener('moving', bindRenderCanvas)
    map.removeEventListener('dragging', bindRenderCanvas)
    container.removeEventListener('mousedown', bindMouseDown)
    container.removeEventListener('mousemove', bindMouseMove)
    container.removeEventListener('mouseup', bindMouseUp)
    container.removeEventListener('contextmenu', bindContextMenu)
  }
}

let forceCustom = false
let minPointCounts = 100

if (window.BMapGL && window.BMapGL.Polygon) {
  const originEnEdit = BMapGL.Polygon.prototype.enableEditing
  
  BMapGL.Polygon.prototype.enableEditing = function(forceOrigin = false) {
    const points = this.getPath()
    if (!forceOrigin && (forceCustom || points.length > minPointCounts)) {
      customEdit(this)
    } else {
      originEnEdit.call(this)
    }
  }
  
  const originDisEdit = BMapGL.Polygon.prototype.disableEditing
  
  BMapGL.Polygon.prototype.disableEditing = function() {
    if (this.__disableEditing) {
      this.__disableEditing()
    } else {
      originDisEdit.call(this)
    }
  }
}


export const setDefaultOptions = opts => {
  pointSize = opts.pointSize || 6
  forceCustom = opts.forceCustom || false
  minPointCounts = opts.minPointCounts || 100
}
