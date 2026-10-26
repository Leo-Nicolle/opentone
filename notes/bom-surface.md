# BOM surface

How much board area the BOM takes, and how much we could get back with smaller packages.

Generated 2026-10-26 from `hardware/opentone/opentone.kicad_pcb` (courtyards) and `docs/public/datasheets/index.json` (MPNs).

## Method

- **Surface = courtyard area** (F.CrtYd/B.CrtYd polygon of each placed footprint, read with `pcbnew`). This is the keep-out a part really costs, not the body size.
- Alternatives are measured on the stock KiCad 10 footprint for that package, with the same method.
- KiCad gives BGA/CSP footprints a 1 mm courtyard margin, which hides most of the gain. For CSP/BGA rows (marked †) the courtyard is taken as body + 0.5 mm per side, the same margin KiCad uses on QFN/SON (e.g. TQFN-40 5x5 → 6.0 x 6.0).
- Routing, vias and spacing between parts are not counted, so the real gain on a packed board is larger than these numbers.
- DNP parts (C64, C207, C307) still have a footprint on the board, so they are counted.

## Totals

| | mm² |
|---|---:|
| Board outline (one side, minus cutout) | ≈ 5804 |
| BOM parts, 260 footprints | **3854** |
| of which top side | 3186 |
| of which bottom side (FPC connectors, wheel buttons, MPR121) | 669 |
| Not in BOM, 34 footprints (solder jumpers, test points, debug headers, J501) | 532 |

The board has 2 copper layers. That rules out the fine-pitch BGA options below unless we go to 4 layers.

### By category

| Category | Parts | mm² | % of BOM |
|---|---:|---:|---:|
| Connectors (FPC, microSD, USB-C, jack, JST) | 7 | 1303 | 33.8 % |
| Passives (R, C, LED, ferrite, fuse, inductor) | 211 | 941 | 24.4 % |
| ICs | 20 | 678 | 17.6 % |
| Bluetooth module | 1 | 483 | 12.5 % |
| Switches | 8 | 340 | 8.8 % |
| Discretes and crystals | 13 | 110 | 2.9 % |

Connectors, the Bluetooth module and switches (55 %) are fixed by mechanics. Package changes can only act on the other 45 %.

## Full BOM

Sorted by total area.

| MPN | Footprint | Qty | mm² each | mm² total | Refs |
|---|---|---:|---:|---:|---|
| FSC-BT1035 | `fsc-bt1035` | 1 | 482.60 | 482.6 | U101 |
| SJ-43515TS-SMT-TR | `CUI_SJ-43515TS-SMT-TR` | 2 | 214.94 | 429.9 | Jack1, Jack2 |
| FH12-40S-0.5SH(55) | `Hirose_FH12-40S-0.5SH_1x40-1MP_P0.50mm_Horizontal` | 2 | 205.85 | 411.7 | J201, J301 |
| STM32F446VET6 | `LQFP-100_14x14mm_P0.5mm` | 1 | 285.68 | 285.7 | U401 |
| DM3AT-SF-PEJM5 | `microSD_HC_Hirose_DM3AT-SF-PEJM5` | 1 | 277.56 | 277.6 | J601 |
| SKQGAFE010 | `SW_SKQGAFE010` | 5 | 47.71 | 238.5 | SW501, SW502, SW503, SW504, SW505 |
| CC0603KRX7R9BB104 | `C_0603_1608Metric` | 39 | 4.28 | 166.8 | C102, C103, C202, C204, C205, C30, C302, C304, C305, C31, C32, C37, C39, C401, C402, C403, C404, C405, C406, C408, C41, C410, C417, C42, C43, C44, C45, C501, C503, C505, C601, C606, C67, C704, C705, C706, C717, C718, C719 |
| 0603WAF1003T5E | `R_0603_1608Metric` | 24 | 4.28 | 102.7 | R101, R112, R16, R17, R213, R3, R313, R34, R36, R41, R42, R43, R44, R45, R46, R47, R509, R6, R610, R620, R7, R701, R705, R8 |
| TYPE-C-31-M-12 | `USB_C_Receptacle_HRO_TYPE-C-31-M-12` | 1 | 100.03 | 100.0 | USB1 |
| VS1053B-L | `LQFP-48_7x7mm_P0.5mm` | 1 | 91.32 | 91.3 | VS1 |
| S2B-PH-SM4-TB(LF)(SN) | `JST_PH_S2B-PH-SM4-TB_1x02-1MP_P2.00mm_Horizontal` | 1 | 84.21 | 84.2 | J3 |
| 0603WAF0000T5E | `R_0603_1608Metric` | 18 | 4.28 | 77.0 | R102, R216, R30, R31, R316, R51, R52, R53, R601, R602, R603, R604, R605, R606, R611, R612, R613, R614 |
| CL10A105KB8NNNC | `C_0603_1608Metric` | 18 | 4.28 | 77.0 | C104, C105, C107, C113, C206, C306, C34, C409, C502, C504, C506, C52, C603, C65, C68, C69, C701, C702 |
| PCM13SMTR | `SW_SP3T_PCM13` | 1 | 59.75 | 59.8 | SW506 |
| 0603WAF1002T5E | `R_0603_1608Metric` | 12 | 4.28 | 51.3 | R33, R40, R401, R501, R503, R504, R505, R506, R507, R508, R607, R706 |
| CL10A225KO8NNNC | `C_0603_1608Metric` | 10 | 4.28 | 42.8 | C411, C412, C707, C708, C711, C712, C713, C714, C715, C716 |
| SN74AVC4T245PWR | `TSSOP-16_4.4x5mm_P0.65mm` | 1 | 42.11 | 42.1 | U703 |
| PTS810SJG250SMTRLFS | `SW_SPST_PTS810` | 2 | 21.00 | 42.0 | SW401, SW402 |
| APS6404L-3SQN-SN | `SOIC-8_3.9x4.9mm_P1.27mm` | 1 | 38.39 | 38.4 | U601 |
| CS43131-CNZ | `TQFN-40-1EP_5x5mm_P0.4mm_EP3.5x3.5mm` | 1 | 36.15 | 36.1 | U701 |
| CL10A106KP8NNNC | `C_0603_1608Metric` | 8 | 4.28 | 34.2 | C101, C201, C301, C33, C35, C40, C605, C66 |
| 0603WAF470KT5E | `R_0603_1608Metric` | 7 | 4.28 | 29.9 | R201, R202, R203, R301, R302, R303, R304 |
| 0603WAF4702T5E | `R_0603_1608Metric` | 7 | 4.28 | 29.9 | R4, R5, R615, R616, R617, R618, R619 |
| CL21A226MAQNNNE | `C_0805_2012Metric` | 4 | 6.61 | 26.4 | C63, C64, C709, C710 (DNP: C64) |
| TPS22917DBVR | `SOT-23-6` | 2 | 13.07 | 26.1 | U102, U602 |
| MCP6001T-I/OT | `SOT-23-5` | 2 | 12.28 | 24.6 | U201, U301 |
| TPS7A2018PDBVR | `SOT-23-5` | 2 | 12.28 | 24.6 | U14, U702 |
| 0603WAF1001T5E | `R_0603_1608Metric` | 5 | 4.28 | 21.4 | R113, R114, R215, R315, R404 |
| DRV2605LDGSR | `VSSOP-10_3x3mm_P0.5mm` | 1 | 20.16 | 20.2 | U502 |
| AO3400A | `SOT-23` | 2 | 9.46 | 18.9 | Q201, Q301 |
| AO3401A | `SOT-23` | 2 | 9.46 | 18.9 | Q1, Q2 |
| MPR121QR2 | `mpr121qr2` | 1 | 18.40 | 18.4 | U501 |
| KT-0603R | `LED_0603_1608Metric` | 4 | 4.28 | 17.1 | D101, D102, D4, D401 |
| GZ1608D601TF | `L_0603_1608Metric` | 4 | 4.28 | 17.1 | FB201, FB3, FB301, FB401 |
| 0603WAF4701T5E | `R_0603_1608Metric` | 4 | 4.28 | 17.1 | R402, R403, R703, R704 |
| K3A080001010 | `Crystal_SMD_3225-4Pin_3.2x2.5mm` | 1 | 14.62 | 14.6 | Y401 |
| TXM12.288M0004322FBCDO00T | `Crystal_SMD_3225-4Pin_3.2x2.5mm` | 1 | 14.62 | 14.6 | Y1 |
| CL21A475KAQNNNE | `C_0805_2012Metric` | 2 | 6.61 | 13.2 | C46, C47 |
| CL21A106KAYNNNE | `C_0805_2012Metric` | 2 | 6.61 | 13.2 | C61, C62 |
| USBLC6-2SC6 | `SOT-23-6` | 1 | 13.07 | 13.1 | U10 |
| CL10A475KO8NNNC | `C_0603_1608Metric` | 3 | 4.28 | 12.8 | C407, C602, C703 |
| 0603WAF1004T5E | `R_0603_1608Metric` | 3 | 4.28 | 12.8 | R18, R32, R35 |
| 0603B472K500NT | `C_0603_1608Metric` | 3 | 4.28 | 12.8 | C207, C307, C60 (DNP: C307, C207) |
| TPS7A2033PDBVR | `SOT-23-5` | 1 | 12.28 | 12.3 | U13 |
| DFE252012P-R47M=P2 | `L_1008_2520Metric_Pad1.43x2.20mm_HandSolder` | 1 | 11.43 | 11.4 | L3 |
| PCA9306DCUR | `VSSOP-8_2.3x2mm_P0.5mm` | 1 | 11.08 | 11.1 | U704 |
| B5819W SL | `D_SOD-123` | 1 | 10.74 | 10.7 | D7 |
| GRM31M5C1H473JA01L | `C_1206_3216Metric` | 1 | 10.51 | 10.5 | C9 |
| MCP73831-2ACI/MC | `DFN-8-1EP_3x2mm_P0.5mm_EP1.7x1.4mm` | 1 | 10.27 | 10.3 | bat-man1 |
| ASMD1206-075 | `Fuse_1206_3216Metric` | 1 | 10.24 | 10.2 | F2 |
| TPS63802DLAR | `Texas_DLA0010A_VSON-HR-10_2x3mm_P0.5mm` | 1 | 10.09 | 10.1 | U11 |
| SMF5.0A | `D_SOD-123F` | 1 | 10.05 | 10.1 | D8 |
| BSS138LT1G | `SOT-23` | 1 | 9.46 | 9.5 | Q101 |
| FC-135 32.7680KA-E | `Crystal_SMD_3215-2Pin_3.2x1.5mm` | 1 | 9.14 | 9.1 | Y402 |
| 0603WAF100KT5E | `R_0603_1608Metric` | 2 | 4.28 | 8.6 | R212, R312 |
| CL10B102KB8NNNC | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C108, C604 |
| 0603WAF200JT5E | `R_0603_1608Metric` | 2 | 4.28 | 8.6 | R14, R2 |
| 0603WAF1000T5E | `R_0603_1608Metric` | 2 | 4.28 | 8.6 | R211, R311 |
| GRM1885C1H103JA01D | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C29, C3 |
| CL10A106MA8NRNC | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C203, C303 |
| CL10C180JB8NNNC | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C36, C38 |
| 0603WAF2001T5E | `R_0603_1608Metric` | 2 | 4.28 | 8.6 | R111, R21 |
| 0603CG6R8C500NT | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C415, C416 |
| 0603WAF5101T5E | `R_0603_1608Metric` | 2 | 4.28 | 8.6 | R19, R20 |
| CL10C150JB8NNNC | `C_0603_1608Metric` | 2 | 4.28 | 8.6 | C413, C414 |
| MAX17048G+T10 | `TDFN-8-1EP_2x2mm_P0.5mm_EP0.8x1.2mm` | 1 | 7.91 | 7.9 | U12 |
| TPD4E05U06DQAR | `USON-10_2.5x1.0mm_P0.5mm` | 1 | 5.41 | 5.4 | U15 |
| 0603WAF5602T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R214 |
| 0603WAF5113T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R37 |
| 0603WAF3902T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R314 |
| 0603WAF2003T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R702 |
| 0603WAF7502T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R502 |
| 0603WAF4700T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R22 |
| 0603WAF9102T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R38 |
| 0603WAF4703T5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R39 |
| 0603WAF100JT5E | `R_0603_1608Metric` | 1 | 4.28 | 4.3 | R13 |
| TPD1E10B06DPYR | `Texas_DPY0002A_0.6x1mm_P0.65mm` | 3 | 1.15 | 3.4 | D701, D702, D703 |
| **Total** | | **260** | | **3854** | |
## Passives

211 passives, 941 mm², 24 % of the BOM. 192 of them are 0603.

### Scenario A: everything one size down (0603 → 0402, 0805 → 0603)

Every 0603 goes to 0402, 0805 bulk caps go to 0603, 1206 parts go to 0603/0805.

| Now | Mapped to | Qty | Now mm² | After mm² | Gain mm² |
|---|---|---:|---:|---:|---:|
| `R_0603_1608Metric` | R 0402 | 99 | 423.5 | 170.3 | 253.1 |
| `C_0603_1608Metric` | C 0402 | 93 | 397.8 | 153.2 | 244.6 |
| `C_0805_2012Metric` | C 0603 | 8 | 52.9 | 34.2 | 18.7 |
| `LED_0603_1608Metric` | LED 0402 | 4 | 17.1 | 6.9 | 10.2 |
| `L_0603_1608Metric` | Ferrite 0402 | 4 | 17.1 | 6.9 | 10.2 |
| `L_1008_2520Metric_Pad1.43x2.20mm_HandSolder` | `L_1008_2520Metric` (drop the HandSolder pads) | 1 | 11.4 | 10.5 | 1.0 |
| `C_1206_3216Metric` | C 0603 (C0G 47 nF exists in 0603, e.g. GRM1885C1H473JA01) | 1 | 10.5 | 4.3 | 6.2 |
| `Fuse_1206_3216Metric` | PTC fuse 0805 | 1 | 10.2 | 6.3 | 3.9 |
| **Total** | | | | | **548** (14 % of BOM) |

### Scenario B: 0201 for resistors and small caps

Resistors and caps ≤ 100 nF go to 0201. Caps ≥ 1 µF, LEDs and ferrites stay at 0402. Rest as in A.

| Now | Mapped to | Qty | Now mm² | After mm² | Gain mm² |
|---|---|---:|---:|---:|---:|
| `R_0603_1608Metric` | R 0201 | 99 | 423.5 | 95.0 | 328.5 |
| `C_0603_1608Metric` ≤100 nF | C 0201 | 52 | 222.4 | 49.9 | 172.6 |
| `C_0603_1608Metric` | C 0402 (≥ 1 µF) | 41 | 175.4 | 67.5 | 107.8 |
| `C_0805_2012Metric` | C 0603 | 8 | 52.9 | 34.2 | 18.7 |
| `LED_0603_1608Metric` | LED 0402 | 4 | 17.1 | 6.9 | 10.2 |
| `L_0603_1608Metric` | Ferrite 0402 | 4 | 17.1 | 6.9 | 10.2 |
| `L_1008_2520Metric_Pad1.43x2.20mm_HandSolder` | `L_1008_2520Metric` (drop the HandSolder pads) | 1 | 11.4 | 10.5 | 1.0 |
| `C_1206_3216Metric` | C 0603 (C0G 47 nF exists in 0603, e.g. GRM1885C1H473JA01) | 1 | 10.5 | 4.3 | 6.2 |
| `Fuse_1206_3216Metric` | PTC fuse 0805 | 1 | 10.2 | 6.3 | 3.9 |
| **Total** | | | | | **659** (17 % of BOM) |

Notes on passives:

- 0402 → 0201 only gains 0.7 mm² per part (1.7 → 1.0) while 0603 → 0402 gains 2.6. Scenario A gets most of the gain. JLC assembles 0201 but charges extra and hand rework gets hard.
- 10 µF / 22 µF in 0402 / 0603 lose a lot of capacitance under DC bias. The 22 µF at C63/C64 (TPS63802 output) and C709/C710 (CS43131 FILT) need a check against the datasheet minimum effective value. C61/C62/C46/C47 are only 13 mm² of gain together, keeping them in 0805 is fine.
- The 0402 ferrites (FB3, FB201, FB301, FB401) only carry AVDD, VDDA and backlight current, so a lower current rating is OK.
- Moving to 0402 means moving off the current part series: UNI-ROYAL 0402WGF and Samsung CL05 are the 0402 equivalents.

## ICs and discretes

Courtyard of the current package vs the smallest package of the same part (or a close replacement).

### Same die, smaller package, fine on 2 layers

| Ref | Now | Package now | mm² now | Alternative | mm² after | Gain mm² | Note |
|---|---|---|---:|---|---:|---:|---|
| U601 | APS6404L-3SQN-SN | `SOIC-8_3.9x4.9mm_P1.27mm` | 38.4 | APS6404L in USON-8 3x2 (package code ZR) | 10.4 | 28.0 | same die; easy win |
| U703 | SN74AVC4T245PWR | `TSSOP-16_4.4x5mm_P0.65mm` | 42.1 | SN74AVC4T245RSVR, UQFN-16 1.8x2.6 | 9.7 | 32.4 | leadless 0.4 mm, fine on 2 layers |
| U704 | PCA9306DCUR | `VSSOP-8_2.3x2mm_P0.5mm` | 11.1 | PCA9306DQER, X2SON-8 1.4x1.0 | 3.2 | 7.9 | 0.35 mm pitch, check fab capability |
| U502 | DRV2605LDGSR | `VSSOP-10_3x3mm_P0.5mm` | 20.2 | DRV2605LYZFR, DSBGA-9 1.5x1.5 † | 6.2 | 13.9 | 3x3 at 0.5 mm, all balls escape on the top layer |
| U12 | MAX17048G+T10 | `TDFN-8-1EP_2x2mm_P0.5mm_EP0.8x1.2mm` | 7.9 | MAX17048X+T10, WLP-8 0.9x1.7 † | 5.1 | 2.8 | 0.4 mm WLP |
| U13 | TPS7A2033PDBVR | `SOT-23-5` | 12.3 | TPS7A2033PDQNR, X2SON-4 1x1 | 2.7 | 9.6 | same die |
| U14 | TPS7A2018PDBVR | `SOT-23-5` | 12.3 | TPS7A2018PDQNR, X2SON-4 1x1 | 2.7 | 9.6 | same die |
| U702 | TPS7A2018PDBVR | `SOT-23-5` | 12.3 | TPS7A2018PDQNR, X2SON-4 1x1 | 2.7 | 9.6 | same die |
| U201 | MCP6001T-I/OT | `SOT-23-5` | 12.3 | MCP6001T-I/LT, SC-70-5 | 8.0 | 4.3 | same die |
| U301 | MCP6001T-I/OT | `SOT-23-5` | 12.3 | MCP6001T-I/LT, SC-70-5 | 8.0 | 4.3 | same die |
| U10 | USBLC6-2SC6 | `SOT-23-6` | 13.1 | USBLC6-2P6, SOT-666 | 6.5 | 6.5 | same die |
| **Total** | | | | | | **129** | |

### Part change, should work after a check

| Ref | Now | Package now | mm² now | Alternative | mm² after | Gain mm² | Note |
|---|---|---|---:|---|---:|---:|---|
| U102 | TPS22917DBVR | `SOT-23-6` | 13.1 | TPS22916 (WCSP-4 0.78x0.78) † | 3.2 | 9.9 | different part: TPS22917 is SOT-23-6 only; TPS22916 has fixed rise time (no CT pin) |
| U602 | TPS22917DBVR | `SOT-23-6` | 13.1 | TPS22916 (WCSP-4 0.78x0.78) † | 3.2 | 9.9 | different part, see U102 |
| Q201 | AO3400A | `SOT-23` | 9.5 | SOT-523 N-MOSFET | 4.8 | 4.7 | backlight switch, low current, fine |
| Q301 | AO3400A | `SOT-23` | 9.5 | SOT-523 N-MOSFET | 4.8 | 4.7 | backlight switch, low current, fine |
| Q101 | BSS138LT1G | `SOT-23` | 9.5 | BSS138 in SOT-523 | 4.8 | 4.7 | logic-level, fine |
| Y401 | K3A080001010 | `Crystal_SMD_3225-4Pin_3.2x2.5mm` | 14.6 | 8 MHz 2016 | 7.7 | 6.9 | recheck load caps |
| Y402 | FC-135 32.7680KA-E | `Crystal_SMD_3215-2Pin_3.2x1.5mm` | 9.1 | 32.768 kHz 2012 (e.g. FC-12M) | 6.5 | 2.6 | recheck load caps |
| Y1 | TXM12.288M0004322FBCDO00T | `Crystal_SMD_3225-4Pin_3.2x2.5mm` | 14.6 | 12.288 MHz oscillator 2016 | 7.7 | 6.9 | check jitter spec |
| D7 | B5819W SL | `D_SOD-123` | 10.7 | B5819WS, SOD-323 | 6.0 | 4.7 | lower surge rating |
| **Total** | | | | | | **55** | |

### Needs 4 layers / via-in-pad

| Ref | Now | Package now | mm² now | Alternative | mm² after | Gain mm² | Note |
|---|---|---|---:|---|---:|---:|---|
| U401 | STM32F446VET6 | `LQFP-100_14x14mm_P0.5mm` | 285.7 | STM32F446ZEJ6, UFBGA-144 7x7 0.5 mm † | 64.0 | 221.7 | only option with enough I/O (83 signal pins used, WLCSP81 has 63 GPIO). 12x12 BGA at 0.5 mm pitch is not routable on this 2-layer board: needs 4+ layers, likely via-in-pad |
| U701 | CS43131-CNZ | `TQFN-40-1EP_5x5mm_P0.4mm_EP3.5x3.5mm` | 36.1 | CS43131-CWZR, WLCSP-42 2.71x3.18 0.4 mm † | 15.5 | 20.6 | 0.4 mm pitch, 6x7 balls: inner balls need via-in-pad / microvias; loses the QFN thermal pad |
| **Total** | | | | | | **242** | |

### Not worth it or not possible

| Ref | Now | Package now | mm² now | Alternative | mm² after | Gain mm² | Note |
|---|---|---|---:|---|---:|---:|---|
| VS1 | VS1053B-L | `LQFP-48_7x7mm_P0.5mm` | 91.3 | none | - | 0.0 | VS1053B only ships in LQFP-48 (VS1063/VS1073 too) |
| Q1 | AO3401A | `SOT-23` | 9.5 | SOT-523 P-MOSFET | 4.8 | 4.7 | different part; check Rds(on)/current |
| Q2 | AO3401A | `SOT-23` | 9.5 | SOT-523 P-MOSFET | 4.8 | 4.7 | different part; check Rds(on)/current |
| D8 | SMF5.0A | `D_SOD-123F` | 10.1 | 5 V TVS in SOD-323 | 6.0 | 4.0 | much lower peak power than 200 W SMF |
| **Total** | | | | | | **13** | |

Also fixed: U11 TPS63802 (VSON-HR 2x3), bat-man1 MCP73831 (DFN 2x3), U501 MPR121 (UQFN-20 3x3), U15 TPD4E05U06 (USON-10), D701-D703 (0.6x1) are already the smallest packages offered.

About the MCU: the STM32F446VET6 is LQFP-100 (14 x 14 mm), not QFN, and it is the single largest IC footprint (286 mm², 7 % of the BOM). All 100 pins are on a net, 83 of them are signal pins (only 5 are spares, on J404, plus the 2 UART pins on J403). STM32F446 packages: WLCSP81 (63 GPIO, too few), LQFP64 (50 GPIO, too few), UFBGA144 7x7 (114 GPIO). So UFBGA144 is the only smaller option, and it means a 4-layer board.

## Summary

| Scenario | Gain mm² | % of BOM (3 854 mm²) |
|---|---:|---:|
| Passives one size down (A) | 548 | 14 % |
| Passives with 0201 (B) | 659 | 17 % |
| ICs, same die, 2-layer OK | 129 | 3 % |
| ICs/discretes, part change | 55 | 1 % |
| MCU UFBGA-144 + CS43131 WLCSP (4 layers) | 242 | 6 % |
| **2 layers: A + same-die ICs + part changes** | 732 | 19 % |
| **2 layers: B + same-die ICs + part changes** | 843 | 22 % |
| **4 layers: B + all ICs** | 1085 | 28 % |

Other things that take room without being in the BOM: the 18 solder jumpers (160 mm²) and the 2.54 mm debug headers J402/J403/J404/J502 (220 mm²). Replacing the 2.54 mm headers with pads or a Tag-Connect footprint gains about as much as the whole IC package pass on 2 layers.

Best value for the effort, in order:

1. Passives 0603 → 0402: ~550 mm², no risk on 2 layers, only a part-series change.
2. APS6404L SOIC-8 → USON-8 and SN74AVC4T245 TSSOP-16 → UQFN-16: 60 mm² for two footprint swaps, same parts.
3. TPS7A20 x3 → X2SON-4: 29 mm², same part.
4. MCU in UFBGA-144: 222 mm² alone, but only if the board goes to 4 layers.
