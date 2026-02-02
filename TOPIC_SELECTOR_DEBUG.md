# Topic Selector 调试指南

## 问题排查步骤

### 1. 检查浏览器控制台
打开浏览器开发者工具（F12），查看 Console 标签页，查找以下日志：
- `[TopicSelector]` - TopicSelector 组件的日志
- `[ROSPlugin]` - ROS 插件的日志

### 2. 检查 ROS 连接状态
确保：
- ROS 连接已建立（`isConnected: true`）
- 当前插件是 ROS 插件（`pluginId: 'ros'`）

### 3. 检查 rosapi 服务
rosapi 是 rosbridge_suite 的一部分，需要运行以下命令启动：

**ROS 1 (Noetic/Melodic):**
```bash
# 方法1: 单独启动 rosapi 节点
rosrun rosapi rosapi_node

# 方法2: 使用 roslaunch（推荐，会自动启动 rosapi）
roslaunch rosbridge_server rosbridge_websocket.launch
```

**ROS 2 (Humble/Foxy):**
```bash
# 方法1: 单独启动 rosapi 节点
ros2 run rosapi rosapi_node

# 方法2: 使用 ros2 launch
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

**验证 rosapi 是否运行:**
```bash
# ROS 1
rosservice list | grep rosapi

# ROS 2
ros2 service list | grep rosapi
```

如果看到 `/rosapi/topics` 和 `/rosapi/topics_and_types` 服务，说明 rosapi 正在运行。

### 4. 验证 rosapi 服务是否可用
在浏览器控制台中，应该看到：
- `[ROSPlugin] getTopics: Got X topics from rosapi` - 成功获取话题
- 或者 `[ROSPlugin] getTopics: rosapi service error` - rosapi 服务不可用

### 5. 手动刷新话题列表
点击 Topic 下拉框旁边的刷新按钮（🔄）来手动刷新话题列表。

## 常见问题

### 问题1: 下拉框显示"暂无可用话题"或"rosapi 服务不可用"
**原因**: rosapi 服务不可用或未运行

**解决方案**:
1. **安装 rosbridge_suite**（如果未安装）:
   ```bash
   # ROS 1
   sudo apt-get install ros-<distro>-rosbridge-suite
   
   # ROS 2
   sudo apt-get install ros-<distro>-rosbridge-suite
   ```

2. **启动 rosapi 节点**:
   ```bash
   # ROS 1
   rosrun rosapi rosapi_node
   # 或
   roslaunch rosbridge_server rosbridge_websocket.launch
   
   # ROS 2
   ros2 run rosapi rosapi_node
   # 或
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml
   ```

3. **临时解决方案**: 即使 rosapi 不可用，您也可以：
   - 在下拉框中手动输入话题名称
   - 下拉框支持 `allow-create` 功能，可以直接输入任何话题名称
   - 输入的话题会被保存，下次打开时会显示在列表中

### 问题2: 控制台显示超时错误
**原因**: rosapi 服务响应超时

**解决方案**:
1. 检查网络连接
2. 检查 rosbridge WebSocket 端口是否正确（默认 9090）
3. 检查防火墙设置

### 问题3: 获取到话题但没有显示
**原因**: 话题类型过滤可能过于严格

**解决方案**:
1. 检查控制台日志中的 `[TopicSelector] Filtered topics` 数量
2. 检查组件类型是否正确传递
3. 检查消息类型映射是否正确

## 调试命令

在浏览器控制台中运行以下命令来手动测试：

```javascript
// 获取当前插件
const plugin = rvizStore.communicationState.currentPlugin
console.log('Plugin:', plugin)

// 手动获取话题
if (plugin && plugin.id === 'ros') {
  plugin.getTopics().then(topics => {
    console.log('Topics:', topics)
  })
  
  plugin.getTopicsAndTypes().then(result => {
    console.log('Topics and Types:', result)
  })
}
```
