# 插件介绍
本插件针对百度地图多边形编辑时，多边形点的数据较多时，造成的卡顿问题。原因是百度的多边形编辑采用的dom元素方式，本库采用canvas方式实现。针对点数大于100的情况下，采用canvas模式，小于100时，采用原生dom模式。
# 使用说明
在入口文件中引入
```js
import 'bmap-polygon-edit-cvs'
```