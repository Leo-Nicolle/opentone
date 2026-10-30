# STM32F446VE (LQFP100) pin allocation

Same chip as the Nucleo's F446RE (same core, peripherals and memory), in the
100-pin package: 81 GPIOs instead of 50. PB11 does not exist on this package
either (that pin is VCAP_1). The test board (`plans/test-board.md`) uses this
exact chip and pinout, soldered directly on the board and flashed over SWD.

**Verdict:** 75 pins assigned, **6 spare**. Every bus has a single user, so the
SPI1 sharing/locking between the SD card and the VS1053 goes away.

Every pin number and alternate function below was checked against the datasheet
(`datasheets/mcu/stm32f446re.pdf`, DS10693 Rev 10, Table 10), and first against the
STM32duino pin map for this exact package
(`variants/STM32F4xx/F446V(C-E)T/PeripheralPins.c`). Signal names follow the
datasheet. The full pin data is in `docs/public/pinout/LQFP100/pins.json`, and
the tables below are generated from `docs/public/pinout/LQFP100/mapping.json`.

## Main choices

- **Display on two byte lanes: PC0-PC7 (low byte) and PD8-PD15 (high byte).**
  The GPIO registers accept byte accesses (`datasheets/mcu/rm0390-stm32f446xx.pdf`,
  §7.4), so each half is one byte store to `ODR` that leaves the other half of
  the port untouched: two stores per pixel instead of one. That costs nothing in
  practice: the ILI9341 write cycle is 66 ns min (tWC), 12 CPU cycles at
  180 MHz. TFT_DC/TFT_WR go through the atomic `BSRR`. No data bit sits on the
  slow PC13-PC15 backup-domain pins (the reason for today's `BROKEN_NUCLEO`
  workaround). Other lanes don't work: PE0-7 and PA0-7 hold the QUADSPI IO2/IO3
  candidates, PB has SWO, BOOT1 and I2C1, PC8-15 has SDIO and PC13-15.
  TFT_RD is tied to 3V3 and TFT_RST to NRST or an RC (see `next-step-pinout.md`).
  The test board has two panels on the same bus, so each gets a CS and a
  backlight PWM.
- **SD card on SDIO, 1-bit mode** (CK PC12, CMD PD2, D0 PC8). SDIO_CMD only
  exists on PD2, which is why the display left the low half of port D.
  1-bit SDIO at 48 MHz is ~6 MB/s, twice SPI at 25 MHz, with DMA, and frees
  SPI1. 4-bit mode would need SDIO_D3, which only exists on PC11, the PSRAM chip
  select: the PSRAM would have to move to QUADSPI bank 1, with its 6 pins spread
  all around the package (pins 1, 24, 37, 66, 78, 92). Audio needs < 0.2 MB/s,
  so 4-bit is not worth it. D1-D3 are not connected to the MCU but still pulled
  up on the card side.
- **PSRAM on quad-SPI bank 2** (PB2 + PE7-PE10, chip select on PC11): pins
  37-41 + 79, short routing for up to 90 MHz. Note that PE7-PE10 are also FMC
  data lines, so the display can't use the FMC LCD interface: the GPIO approach
  is the right one. The FMC is limited on this package anyway: only Bank 1, for
  a multiplexed NOR/PSRAM on NE1 (datasheet Table 2, note 1).
- **VS1053 alone on SPI2.** The SD card and the VS1053 each get their own
  TPS22917 switch. While a device is off, the firmware puts its lines in analog
  mode or holds them low, so nothing back-powers the chip through its I/O pins.
- **One I2C bus (I2C1 on PB6/PB7)** for the MPR121 (0x5B), the DRV2605L (0x5A),
  the MAX17048 (0x36) and the CS43131 DAC: check the DAC address against these
  before routing. That frees PB10 for the backlight PWM.
- **Bluetooth on USART2 with hardware flow control** (PD3-PD6), freed by the
  display byte lanes. The log UART moves to UART4 (PA0/PA1).
- **USB and HSE crystal reserved.** PA11/PA12 (USB FS) and PA9 (VBUS sense) go
  to the USB-C connector directly (mass storage, DFU flashing). USB needs an
  accurate 48 MHz clock, so PH0/PH1 hold an 8 MHz crystal instead of being
  GPIOs. This package has no VDDUSB pin: the USB pins run from VDD, and the USB
  transceiver needs 3.0-3.6 V, so VDD must stay at 3.3 V while USB is in use.
  PC14/PC15 hold the 32.768 kHz LSE crystal (RTC, wake-up from stop mode).
- **Each interrupt input on its own EXTI line**, so buttons, lock and IRQs can
  all wake the MCU and be told apart (EXTI5-9 and EXTI10-15 each share one
  interrupt vector, so the handler reads the pending bits): PB0 (EXTI0, charger),
  PB1 (EXTI1, jack 1), PE3 (EXTI3), PE4 (EXTI4), PE5 (EXTI5), PE6 (EXTI6),
  PA8 (EXTI8, SD detect), PA9 (EXTI9), PA10 (EXTI10, DAC INT), PE11-PE15
  (EXTI11-15).

## Allocation

### Screen (ILI9341) (16-bit parallel, two byte lanes)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PC0 | 15 | D0 | Low byte lane: one byte store to GPIOC->ODR (RM0390 7.4: GPIO registers accept byte accesses). PC0-PC7 only, PC8-PC15 are untouched. |
| PC1 | 16 | D1 |  |
| PC2 | 17 | D2 |  |
| PC3 | 18 | D3 |  |
| PC4 | 33 | D4 |  |
| PC5 | 34 | D5 |  |
| PC6 | 63 | D6 |  |
| PC7 | 64 | D7 |  |
| PD8 | 55 | D8 | High byte lane: one byte store to the second byte of GPIOD->ODR, PD0-PD7 are untouched. Two stores per pixel fit in the ILI9341 66 ns write cycle (12 CPU cycles at 180 MHz). |
| PD9 | 56 | D9 |  |
| PD10 | 57 | D10 |  |
| PD11 | 58 | D11 |  |
| PD12 | 59 | D12 |  |
| PD13 | 60 | D13 |  |
| PD14 | 61 | D14 |  |
| PD15 | 62 | D15 |  |
| PD0 | 81 | TFT_DC | Set/reset through BSRR (atomic, does not disturb the data lane). |
| PD1 | 82 | TFT_WR | Toggled per pixel through BSRR. |
| PB8 | 95 | TFT_CS1 (panel 1 chip select) | Both panels share the data bus, so each needs its own CSX. |
| PB9 | 96 | TFT_CS2 (panel 2 chip select) | Test board only (second FFC). |
| PB10 | 47 | Backlight 1 PWM (TIM2_CH3) | Gates the panel's constant-current backlight sink (op-amp + N-MOSFET, see hardware/opentone/screens.kicad_sch). TFT_RD is tied to 3V3 and TFT_RST to NRST or an RC, so they take no pins. |
| PA3 | 26 | Backlight 2 PWM (TIM2_CH4) | Test board only (second FFC). Same timer as backlight 1. |

### PSRAM (APS6404L) (QUADSPI bank 2)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB2 | 37 | PSRAM_CLK (QUADSPI_CLK) | Also BOOT1: only sampled at reset when BOOT0 = 1. |
| PC11 | 79 | PSRAM_CS (QUADSPI_BK2_NCS) | Bank 2 chip select. The bank 1 NCS is only on PB6, which I2C1 needs. |
| PE7 | 38 | PSRAM_IO0 (QUADSPI_BK2_IO0) |  |
| PE8 | 39 | PSRAM_IO1 (QUADSPI_BK2_IO1) |  |
| PE9 | 40 | PSRAM_IO2 (QUADSPI_BK2_IO2) | IO2 only exists on PE2 (bank 1) or PE9 (bank 2) in this package. |
| PE10 | 41 | PSRAM_IO3 (QUADSPI_BK2_IO3) |  |

### SD card (SDIO 1-bit)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PC12 | 80 | SDIO_CK |  |
| PD2 | 83 | SDIO_CMD | SDIO_CMD only exists on PD2: the reason the screen moved to byte lanes. |
| PC8 | 65 | SDIO_D0 | 1-bit mode: D3 only exists on PC11 (PSRAM CS). Pull up CMD, D0 and the unused D1-D3 on the card side to the switched SD rail. |
| PA7 | 32 | SD_EN (TPS22917 ON) | Put PC12/PD2/PC8 in analog mode while the card is off so nothing back-powers it. |
| PA8 | 67 | SD card detect | EXTI8. |

### VS1053 (SPI2)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB12 | 51 | MP3CS (chip select) |  |
| PB13 | 52 | SPI2_SCK |  |
| PB14 | 53 | SPI2_MISO |  |
| PB15 | 54 | SPI2_MOSI |  |
| PA4 | 29 | MP3XDCS (data/command) |  |
| PA5 | 30 | MP3_RESET |  |
| PE5 | 4 | MP3DREQ |  |
| PA6 | 31 | VS_EN (TPS22917 ON) | Hold XRESET low and the SPI2 lines low while the VS1053 is off. SPI2 is on APB1: 22.5 MHz max SCK. |

### MPR121 (I2C1)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB6 | 92 | SCL (I2C1_SCL) | Shared with the DRV2605L (0x5A) and the MAX17048 (0x36). MPR121 ADDR tied to 3.3V (0x5B). |
| PB7 | 93 | SDA (I2C1_SDA) |  |
| PE4 | 3 | ~IRQ (active low, open-drain) |  |

### DRV2605L (haptic) (I2C1)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB6 | 92 | SCL (I2C1_SCL) |  |
| PB7 | 93 | SDA (I2C1_SDA) |  |
| PB5 | 91 | EN (hardware shutdown) | Optional. |

### MAX17048 (fuel gauge) (I2C1)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB6 | 92 | SCL (I2C1_SCL) |  |
| PB7 | 93 | SDA (I2C1_SDA) |  |
| PE6 | 5 | ~ALRT (low battery, open-drain) |  |

### Charger (MCP73831) (GPIO)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB0 | 35 | STAT (charging / done) | EXTI0. |

### DAC (CS43131) (I2C1 + I2S from the VS1053)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB6 | 92 | SCL (I2C1_SCL) |  |
| PB7 | 93 | SDA (I2C1_SDA) |  |
| PE1 | 98 | DAC_RESET | 100k pull-down. Hold low >= 1 ms after DAC_1V8 is up, before any I2C access. |
| PE2 | 1 | DAC_EN (TPS7A2018 EN + PCA9306 EN) | 100k pull-down. Switches DAC_1V8 and disconnects the DAC from I2C1 through the PCA9306. VP stays on +3.3V. |
| PA10 | 69 | DAC_INT (CS43131 INT, open drain) | EXTI10. 10k pull-up to +3.3V. Jack 2 plug/unplug comes through here (DAC HP_DETECT). |

### Headphone jacks (GPIO)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PB1 | 36 | Jack 1 detect | EXTI1. |

### Bluetooth (FSC-BT1035) (USART2)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PD5 | 86 | USART2_TX -> BT_RX |  |
| PD6 | 87 | USART2_RX <- BT_TX |  |
| PD3 | 84 | USART2_CTS <- BT_RTS | Hardware flow control. |
| PD4 | 85 | USART2_RTS -> BT_CTS | Hardware flow control. |
| PD7 | 88 | BT_EN (TPS22917 ON) | The module's auto power-on circuit boots it once powered. Audio goes VS1053 I2S -> module directly, not through the STM32. |
| PE0 | 97 | BT_RESET (open-drain) | Optional. |

### Click-wheel buttons (GPIO)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PE11 | 42 | Center |  |
| PE12 | 43 | Top |  |
| PE13 | 44 | Right |  |
| PE14 | 45 | Bottom |  |
| PE15 | 46 | Left | PE11-PE15 are adjacent package pins 42-46, each on its own EXTI line (EXTI10-15 share one NVIC vector). |

### Power / hold slider (GPIO)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PE3 | 2 | LOCK (HOLD position, active low) | OFF / HOLD / ON slider: HOLD pulls it low, OFF pulls 3V3_EN low (no MCU pin). Going from ON to OFF passes HOLD, so save the state and finish SD writes on its falling edge. Own EXTI line, can wake the MCU. |

### USB (OTG_FS)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PA11 | 70 | D- (OTG_FS_DM) |  |
| PA12 | 71 | D+ (OTG_FS_DP) |  |
| PA9 | 68 | VBUS sense (OTG_FS_VBUS) | Also tells the firmware a charger is attached. |

### Crystals (Clock)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PH0 | 12 | OSC_IN (8 MHz crystal) | USB needs an accurate 48 MHz clock, the HSI is not good enough. |
| PH1 | 13 | OSC_OUT |  |
| PC14 | 8 | OSC32_IN (32.768 kHz crystal) | LSE: RTC and wake-up from stop mode. |
| PC15 | 9 | OSC32_OUT |  |

### Debug (SWD + UART4)

| Pin | LQFP100 # | Function | Notes |
|---|---|---|---|
| PA13 | 72 | SWDIO |  |
| PA14 | 76 | SWCLK |  |
| PB3 | 89 | SWO (trace output) | Optional: printf over SWD. |
| PA0 | 23 | Log UART4_TX |  |
| PA1 | 24 | Log UART4_RX |  |

### Spare (6)

PA2 (25), PA15 (77), PB4 (90), PC9 (66), PC10 (78), PC13 (7)

PA15 and PB4 are JTAG pins (JTDI, NJTRST) after reset: free once debug is SWD
only. PC13 is a backup-domain pin (2 MHz, 3 mA sink, no sourcing): keep it for
slow signals.

## Firmware changes

- Display driver: data goes out as two byte stores (GPIOC low byte, GPIOD high
  byte), DC/WR move to PD0/PD1, and the `BROKEN_NUCLEO` paths (PA0/PA1 data
  bits, `BUS_PORTC_MASK`) go away.
- PSRAM driver: SPI2 becomes the QUADSPI peripheral (the APS6404L supports quad
  mode). Memory-mapped mode is read-only on the F4: writes go through indirect
  mode, split to respect the APS6404L max CS low time (tCEM).
- VS1053 driver: `SPI` (SPI1) becomes an `SPIClass` on SPI2. The `spi1bus`
  lock, `feedPending` and the "TIM7 waits for the bus" logic can be removed.
- SD card: SdFat on SPI becomes the SDIO peripheral in 1-bit mode with DMA
  (e.g. the STM32duino `STM32SD` library), no lock needed.
- `Wire3` (I2C3, PB4/PA8) becomes `Wire` on PB6/PB7.
- Bluetooth: `HardwareSerial` on USART2 (PD6 RX, PD5 TX) with RTS/CTS on
  PD4/PD3. Logs: `HardwareSerial` on UART4 (PA1 RX, PA0 TX).
- `pinout.h`: update to this table once it's final. The table is already in
  `docs/public/pinout/LQFP100/mapping.json` (shown by the pinout studio's
  LQFP100 package).
