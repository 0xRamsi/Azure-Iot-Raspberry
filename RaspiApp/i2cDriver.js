const i2c = require("i2c-bus");
const sleep = require("sleep");

const LCD_I2C_ADDRESS = 0x27;
const I2C_BUS_NUMBER = 1;
const LCD_BACKLIGHT = 0x08;
const LCD_REGISTER_SELECT_CMD = 0x00;
const LCD_REGISTER_SELECT_CHAR = 0x01;
const LCD_ENABELE = 0x04;

function rawTimedWrite(i2c_bus, dataInUpperNibble, cmdOrChar) {
  let cleanData = dataInUpperNibble & 0xf0;
  let cleanRS = cmdOrChar & 0x1;

  i2c_bus.i2cWrite(
    LCD_I2C_ADDRESS,
    1,
    Buffer.from([cleanData | LCD_BACKLIGHT | cleanRS]),
    handleError
  );
  i2c_bus.i2cWrite(
    LCD_I2C_ADDRESS,
    1,
    Buffer.from([cleanData | LCD_BACKLIGHT | LCD_ENABELE | cleanRS]),
    handleError
  );
  i2c_bus.i2cWrite(
    LCD_I2C_ADDRESS,
    1,
    Buffer.from([cleanData | LCD_BACKLIGHT | cleanRS]),
    handleError
  );

  sleep.msleep(2);
}

function positionCursor(i2c_bus, line, column) {
  let cleanLine = line & 1;
  let cleanColumn = column & 0xf;
  rawTimedWrite(i2c_bus, 0x80 | (cleanLine << 6), LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, cleanColumn << 4, LCD_REGISTER_SELECT_CMD);
}

function createWriteString(i2c_bus) {
  return (line, offset, stringToDisplay) => {
    positionCursor(i2c_bus, line, offset);
    stringToDisplay.split("").forEach((c) => {
      let dataToSend = c.charCodeAt(0);
      rawTimedWrite(i2c_bus, dataToSend & 0xf0, LCD_REGISTER_SELECT_CHAR);
      rawTimedWrite(
        i2c_bus,
        (dataToSend << 4) & 0xf0,
        LCD_REGISTER_SELECT_CHAR
      );
    });
  };
}

function initiazeLCD(i2c_bus) {
  sleep.msleep(15);
  rawTimedWrite(i2c_bus, 0x30, LCD_REGISTER_SELECT_CMD);
  sleep.usleep(4100);
  rawTimedWrite(i2c_bus, 0x30, LCD_REGISTER_SELECT_CMD);
  sleep.usleep(100);
  rawTimedWrite(i2c_bus, 0x30, LCD_REGISTER_SELECT_CMD);

  rawTimedWrite(i2c_bus, 0x20, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x20, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x80, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x00, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0xc0, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x00, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x10, LCD_REGISTER_SELECT_CMD);
  rawTimedWrite(i2c_bus, 0x00, LCD_REGISTER_SELECT_CMD);
}

const i2c1 = i2c.openSync(I2C_BUS_NUMBER);

initiazeLCD(i2c1);
const writeString = createWriteString(i2c1);

writeString(0, 5, "Hallo,");
writeString(1, 5, "Welt!");

function handleError(error, bytesWritten, buffer) {
  if (error) {
    console.log("Error writing to I2C bus:", error);
  }
}

module.exports = { writeString };
