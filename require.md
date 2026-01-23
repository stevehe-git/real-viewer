# Vue 3 + TypeScript + Vite

## 创建项目
```
pnpm create vite ros-viewer --template vue-ts
```

## 要求
### 能封装成组件的尽量封装成组件
### 能单独抽取的函数尽量抽取
### UI显示代码最好跟业务逻辑代码分离
### 代码可维护性，单一性，可复用原则
### 围绕高性能低延迟进行编码
### 封装通用数据结构，用于UI中显示
### 目前接收ROS数据格式数据，后面可能接收protobuf或者json格式数据
### 需要支持ROS/mqtt/websocket等等扩展协议
### 支持ROS1 move_base rviz可视化效果
### 支持路由(导航,控制,数据包分析等等)
### 支持pina数据管理