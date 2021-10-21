// pages/ble/ble.js
const app = getApp()
// 圆弧半径
const radius = app.globalData.windowWidth_curr * 3 / 10;
// 内圆宽度
const sweepInWidth = 10;
// 外圆宽度
const sweepOutWidth = 3;
// 圆弧初始的弧度
const startAngle = .9 * Math.PI;
// 圆弧结束的弧度
const endAngle = 2.1 * Math.PI;
// 圆弧扫过的弧度
const sweepAngle = 1.2 * Math.PI;
const ctx = wx.createCanvasContext('credit-canvas');

function inArrayble(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 蓝牙与通信相关
    devices: [],
    chs: [],
    ble_data_recver: [], //蓝牙数据
    devicename: 0,
    min:0,
    max:16,
    value:0,

    //产品功能相关
    speak_on_off: true, //语音开关  
    bat_index: 0, //电池电量
    qiandu_index: 1, //按摩强度
    timeleft: 900, //倒计时时间 秒
    mode_slect: 0, //实时模式
    protect_time: 0, // 保护时间
    //绘图与显示相关
    canvasWidth: app.globalData.windowWidth_curr,
    canvasHeight: app.globalData.windowWidth_curr * 3 * 6 / 40 + 2,

    // 定时相关
    time_interv_index: 0,
  },

  
  closeBLEConnection() {
    wx.closeBLEConnection({
      deviceId: this.data.deviceId
    })
    this.setData({
      scanbit_flag: false,
      chs: [],
      canWrite: false,
    })
  },

  // 连接成功后获取相关的服务
  getBLEDeviceServices(deviceId) {
    wx.onBLEConnectionStateChange(function (res) { // 该方法回调中可以用于处理连接意外断开等异常情况  
      console.log("onBLEConnectionStateChange:", res);
      if (res.connected == false) {
        console.log("连接意外断开等**退出BLE**");
        wx.closeBLEConnection({
          deviceId: app.globalData.conct_deviceid,
          success(res) {
            console.log(res)
          }
        })
        wx.navigateBack({
          delta: 0,
        })
        return
      }
    });

    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        for (let i = 0; i < res.services.length; i++) {
          if (res.services[i].isPrimary) {
            this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
            return
          }
        }
      }
    })
  },

  getBLEDeviceCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('getBLEDeviceCharacteristics success', res.characteristics)
        for (let i = 0; i < res.characteristics.length; i++) {
          let item = res.characteristics[i]
          if (item.properties.read) {
            wx.readBLECharacteristicValue({
              deviceId,
              serviceId,
              characteristicId: item.uuid,
            })
          }
          if (item.properties.write) {
            this.setData({
              canWrite: true
            })
            this._deviceId = deviceId
            this._serviceId = serviceId
            this._characteristicId = item.uuid
            this.send_cmd_data(0xB0, 0x00);
          }
          if (item.properties.notify || item.properties.indicate) {
            wx.notifyBLECharacteristicValueChange({ //启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值。
              deviceId,
              serviceId,
              characteristicId: item.uuid,
              state: true,
              success(res) {
                console.log('notifyBLECharacteristicValueChange success', res.errMsg)
              }
            })
          }
        }
      },
      fail(res) {
        console.error('getBLEDeviceCharacteristics', res)
      }
    })
    // 操作之前先监听，保证第一时间获取数据  开启 监听回调
    wx.onBLECharacteristicValueChange((characteristic) => {
      let dataView = new DataView(characteristic.value)
      for (let ii = 0; ii < characteristic.value.byteLength; ii++) {
        this.data.ble_data_recver.push(dataView.getUint8(ii))
      }
      this.recever_data_refrsh_display();
    })
  },

  recever_data_refrsh_display() {
    let all_length = this.data.ble_data_recver.length
    while (all_length > 19) {
      let data = this.data.ble_data_recver
      let buff_temp = new Array
      let ii = 0
      for (ii = 0; ii < data.length - 19; ii++) {
        if (data[ii] === 0xFE && data[ii + 1] === 0xB0)
          break;
      }
      if (data.length - ii < 20) return
      buff_temp = data.slice(ii, ii + 20)
      this.data.ble_data_recver.splice(0, ii + 20)
      all_length -= ii + 20  // all_length = all_length - (ii + 20)
      let data_sum = 0x00;
      for (ii = 0x00; ii < 19; ii++) {
        data_sum = (data_sum + buff_temp[ii]) & 0xff
      }
      if (data_sum == buff_temp[19]) {
        if (buff_temp[4] === 0x00) {
          console.log("产品关机**退出BLE**"+buff_temp[4]);
          wx.closeBLEConnection({
            deviceId: app.globalData.conct_deviceid,
            success(res) {
              console.log(res)
            }
          })
          return
        }
        if (!this.data.protect_time) { //1为true 0为fasle
          this.setData({
            speak_on_off: buff_temp[9],
            bat_index: buff_temp[8],
            qiandu_index: buff_temp[6],
            // wendu_index: buff_temp[7],
            mode_slect: buff_temp[5],
          })
          console.log("当前的电量的index是："+this.data.bat_index)
        }
        this.setData({
          timeleft: buff_temp[10] * 256 + buff_temp[11],
        })
        this.drawCredit();
        console.log(buff_temp)
        console.log("1包数据")
      }
    }
  },
  

  // 监听蓝牙适配器状态
  getBluetoothState(){
    wx.getBluetoothAdapterState({
      success: (res) => {
        if(res.available){
          console.log('蓝牙适配器可用')
        } else {
          console.log(res.errCord)
          console.log('蓝牙适配器不可用')
        }
      },
    })
  },

  //关闭蓝牙模块
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter()
    this._discoveryStarted = false
  },


  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // common.myContent(); //需要执行才能生效哈
    const deviceId = app.globalData.conct_deviceid
    const deviceName = app.globalData.conct_name
    this.getBLEDeviceServices(deviceId) // 获取连接device信息
    this.drawCredit();
    wx.setNavigationBarTitle({
      title: deviceName,
    })
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    console.log("推出BLE页面")
    wx.closeBLEConnection({
      deviceId: app.globalData.conct_deviceid,
      success(res) {
        console.log(res)
      }
    })
  },
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    this.timeout = setTimeout(this.drawCredit, 100);
    // 获取devicename
    const deviceName = app.globalData.conct_name
    this.getBLEDeviceServices(deviceName)
  },

  drawCredit: function () {
    const that = this
    ctx.translate(this.data.canvasWidth / 2, this.data.canvasHeight * 3 / 4); //对当前坐标系的原点 (0, 0) 进行变换。默认的坐标系原点为页面左上角。
    // 画内外圆弧
    function drawRound() {
      // 内圆
      // 保存画布
      ctx.save();
      /*  */
      // 每次设置画笔时要调用这个beginPath，非则以最后一次为准。  
      ctx.beginPath();
      // 设置画笔宽度
      ctx.setLineWidth(sweepInWidth);
      // 设置画笔颜色
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.3)')
      // 画内圆弧形，角度为162度~378度，起始位置由于调用过ctx.translate(this.data.canvasWidth/2,this.data.canvasHeight*3/4);，所以在中心位置
      ctx.arc(0, 0, radius, startAngle, endAngle);
      // 描绘路径边框
      ctx.stroke();

      // 画外圆
      ctx.beginPath() //开始创建一个路径。需要调用 fill 或者 stroke 才会使用路径进行填充或描边
      ctx.setLineWidth(sweepOutWidth); // 设置画笔宽度
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.3)') // 设置画笔颜色
      ctx.arc(0, 0, radius + 10, startAngle, endAngle); // 画圆弧形，
      ctx.stroke(); // 描绘路径边框
      // 还原画布
      ctx.restore();
    }

    function drawScale() {
      // 画刻度
      const startNum = 0;
      // 画布旋转弧度
      const angle = 3 * (36 / 15) * Math.PI / 90;
      ctx.save();
      ctx.rotate((-1.5 * Math.PI) + startAngle)
      for (let i = 0; i <= 15; i++) {
        if (i % 3 === 0) {
          //画粗刻度并写数值
          ctx.beginPath()
          ctx.setLineWidth(2)
          ctx.setStrokeStyle('rgba(255, 255, 255, 1)')
          ctx.moveTo(0, -radius - sweepInWidth / 2);
          ctx.lineTo(0, -radius + sweepInWidth / 2 + 1);
          ctx.stroke()
          // 设置文字画笔
          ctx.setFontSize(12)
          ctx.setTextAlign('center')
          ctx.setFillStyle('rgba(255, 255, 255, 1)')
          ctx.fillText(startNum + (i) + "", 0, -radius + 20)
        } else {
          ctx.beginPath()
          ctx.setLineWidth(1)
          ctx.setStrokeStyle('rgba(255, 255, 255, 0.8)')
          ctx.moveTo(0, -radius - sweepInWidth / 2);
          ctx.lineTo(0, -radius + sweepInWidth / 2 + 1);
          ctx.stroke()
        }
        ctx.rotate(angle)
      }
      // 还原画布
      ctx.restore();
    }

    function drawIndicator() {
      ctx.save();
      let sweep = 0;
      sweep = that.data.timeleft * sweepAngle / 900
      // 画指示点圆弧
      const grd = ctx.createLinearGradient(0, 0, 200, 0)
      grd.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
      grd.addColorStop(1, 'rgba(255, 255, 255, 0.7)')
      ctx.beginPath()
      ctx.setStrokeStyle(grd)
      ctx.setLineWidth(sweepOutWidth);
      ctx.arc(0, 0, radius + 10, startAngle, startAngle + sweep);
      ctx.stroke()
      // 画指示点
      let x = (radius + 10) * Math.cos(startAngle + sweep)
      let y = (radius + 10) * Math.sin(startAngle + sweep)
      ctx.beginPath()
      ctx.setStrokeStyle('white')
      ctx.fill()
      ctx.arc(x, y, 3, 0, 2 * Math.PI)
      ctx.stroke()
      // 还原画布
      ctx.restore();
    }

    function drawCenterText() {
      ctx.save();
      //设置文字画笔
      ctx.beginPath();
      ctx.setFontSize(radius / 8)
      ctx.setTextAlign('center')
      ctx.setFillStyle('white')
      let lever = "剩余时间"
      ctx.fillText(lever, 0, -radius / 2)
      // 绘制时间
      ctx.setFontSize(radius / 5)
      let veiw_data = that.data.timeleft % 60
      if (veiw_data < 10) {
        ctx.fillText(Math.floor(that.data.timeleft / 60) + ' : 0' + veiw_data, 0, -radius / 6)
      } else {
        ctx.fillText(Math.floor(that.data.timeleft / 60) + ' : ' + veiw_data, 0, -radius / 6)
      }
      // 绘制档位
      let content = "档位：";
      content += that.data.qiandu_index;
      ctx.setFontSize(radius / 8)
      ctx.fillText(content, 0, radius / 6)
      // 还原画布
      ctx.restore();
      console.log("正在画画.....")
    }
    drawRound();
    drawScale();
    drawIndicator();
    drawCenterText();
    ctx.draw();
  },

  send_cmd_data(cmd, data) {
    let buff_u8 = new Array
    let ii = 0x00;
    let sum = 0x00;
    buff_u8[ii++] = 0xFE;
    buff_u8[ii++] = cmd;
    buff_u8[ii++] = 0x01;
    buff_u8[ii++] = data;
    for (let jj = 0x00; jj < ii; jj++) {
      sum += buff_u8[jj]
    }
    buff_u8[ii] = sum % 256;
    // 向蓝牙设备发送一个0x00的16进制数据 
    let buffer = new ArrayBuffer(buff_u8.length)
    let dataView = new DataView(buffer)
    for (ii = 0; ii < buff_u8.length; ii++) {
      dataView.setUint8(ii, buff_u8[ii])
    }
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
      fail(res){      
          console.log(res)        
      }
    })
    console.log("send_cmd_data下发数据成功")
  },

  // 保护时间 只手机下发数据之后的200ms内接受的数据包都给丢掉 
  // 因为下发数据之后的值界面直接改变，但是在下发同时还会有上方数据包，如果接受这个上发数据包的话，界面的值就会改变，所以才需要这个保护事件
  set_protect_time(e) {
    const that = this
    this.setData({
      protect_time: 1,
    })
    setTimeout(function () {
      that.setData({
        protect_time: 0,
      })
      console.log("一次保护")
    }, 600);
  },

  // 关机操作
  ble_power_off(e) {
    let that = this
    wx.showModal({
      title:'提示',
      content:'确认是否退出？',
      success (res) {
        if (res.confirm){
          console.log('用户点击确定，确认退出')
          that.send_cmd_data(0x10, 0x00);
          wx.navigateBack({
            delta: 0,
          })
        }
      }
    })
  },

  //脉冲强度
  slider_qiandu_changer(e) {
    //获取滑动后的值
    let bef = this.data.qiandu_index
    console.log('拖动前的值是：'+ bef)
    this.setData({
      qiandu_index: e.detail.value,
    })
    let aft = this.data.qiandu_index
    console.log('拖动后的值是：'+ aft)
    if ((aft-bef) > 2 || (aft-bef) < -2) {
      let that = this
      wx.showModal({
        // 弹出提示框
        title:'提示',
        content:"确定将强度调到第"+this.data.qiandu_index+"档吗？",
        success(res){
          if(res.confirm){
            // 表示用户点击了确定，执行它的跳转到新的值
            // this.set_protect_time()
            that.setData({
              qiandu_index: aft,
            })
            console.log("用户点击了确定，跳转到新的值"+aft)
            that.drawCredit()
            that.set_protect_time()
            console.log("下发强度值："+aft)
            that.send_cmd_data(0x12,aft); // 发送指令到底层
          } else if(res.cancel) {
            // 表示用户点击了取消，执行旧的值
            console.log("用户点击了取消，不跳转到新的值"+bef)
            that.setData({
              qiandu_index: bef,
            })
            that.drawCredit()
            that.set_protect_time()
            console.log("下发强度值："+bef)
            that.send_cmd_data(0x12,bef); // 发送指令到底层
          }
        }
      })
      console.log("成功弹出提示框")
    } 
  },

  qiandu_add(e) {
    let data = this.data.qiandu_index;
    if (data < 16) data++;
    this.set_protect_time()
    this.setData({
      qiandu_index: data,
    })
    this.drawCredit();
    this.send_cmd_data(0x12, this.data.qiandu_index);
  },

  qiandu_dec(e) {
    let data = this.data.qiandu_index;
    if (data > 0) data--;
    this.setData({
      qiandu_index: data,
    })
    this.drawCredit();
    this.set_protect_time()
    this.send_cmd_data(0x12, this.data.qiandu_index);
  },

  // 模式选择
  mode_slect_auto(e) {
    this.setData({
      mode_slect: 0,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  },

  mode_slect_guasha(e) {
    this.setData({
      mode_slect: 2,
    })
    this.set_protect_time()
    this.send_cmd_data(0x11, this.data.mode_slect);
  }
})

