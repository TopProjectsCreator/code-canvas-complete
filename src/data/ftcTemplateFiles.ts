import { FileNode } from "@/types/ide";

/**
 * FTC template files based on the official FIRST Tech Challenge
 * FtcRobotController project structure from:
 * https://github.com/FIRST-Tech-Challenge/FtcRobotController
 */
export const ftcTemplate: FileNode[] = [
  {
    id: "root",
    name: "FtcRobotController",
    type: "folder",
    children: [
      {
        id: "ftc-teamcode",
        name: "TeamCode",
        type: "folder",
        children: [
          {
            id: "ftc-teamcode-src",
            name: "src",
            type: "folder",
            children: [
              {
                id: "ftc-teamcode-main",
                name: "main",
                type: "folder",
                children: [
                  {
                    id: "ftc-teamcode-java",
                    name: "java",
                    type: "folder",
                    children: [
                      {
                        id: "ftc-teamcode-org",
                        name: "org",
                        type: "folder",
                        children: [
                          {
                            id: "ftc-teamcode-firstinspires",
                            name: "firstinspires",
                            type: "folder",
                            children: [
                              {
                                id: "ftc-teamcode-ftc",
                                name: "ftc",
                                type: "folder",
                                children: [
                                  {
                                    id: "ftc-teamcode-pkg",
                                    name: "teamcode",
                                    type: "folder",
                                    children: [
                                      {
                                        id: "ftc-basic-opmode",
                                        name: "BasicOpMode_Linear.java",
                                        type: "file",
                                        language: "java",
                                        content: `/* Copyright (c) 2017 FIRST. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted (subject to the limitations in the disclaimer below) provided that
 * the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list
 * of conditions and the following disclaimer.
 *
 * Neither the name of FIRST nor the names of its contributors may be used to endorse or
 * promote products derived from this software without specific prior written permission.
 *
 * NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED BY THIS
 * LICENSE. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.util.ElapsedTime;
import com.qualcomm.robotcore.util.Range;

/**
 * This file contains a minimal example of a Linear "OpMode".
 * Based on the official FTC SDK sample from:
 * https://github.com/FIRST-Tech-Challenge/FtcRobotController
 *
 * This OpMode executes a basic Tank Drive Teleop for a two wheeled robot.
 * It includes all the skeletal structure that all linear OpModes contain.
 *
 * Use Android Studio to Copy this Class, and Paste it into your team's code
 * folder with a new name. Remove or comment out the @Disabled line to add
 * this OpMode to the Driver Station OpMode list.
 */

@TeleOp(name = "Basic: Linear OpMode", group = "Linear OpMode")
public class BasicOpMode_Linear extends LinearOpMode {

    // Declare OpMode members.
    private ElapsedTime runtime = new ElapsedTime();
    private DcMotor leftDrive = null;
    private DcMotor rightDrive = null;

    @Override
    public void runOpMode() {
        telemetry.addData("Status", "Initialized");
        telemetry.update();

        // Initialize the hardware variables. Note that the strings used here as parameters
        // to 'get' must correspond to the names assigned during the robot configuration
        // step (using the FTC Robot Controller app on the phone).
        leftDrive  = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");

        // To drive forward, most robots need the motor on one side to be reversed,
        // because the axles point in opposite directions.
        leftDrive.setDirection(DcMotor.Direction.REVERSE);
        rightDrive.setDirection(DcMotor.Direction.FORWARD);

        // Wait for the game to start (driver presses START)
        waitForStart();
        runtime.reset();

        // run until the end of the match (driver presses STOP)
        while (opModeIsActive()) {
            // POV Mode uses left stick to go forward, and right stick to turn.
            double drive = -gamepad1.left_stick_y;
            double turn  =  gamepad1.right_stick_x;
            double leftPower  = Range.clip(drive + turn, -1.0, 1.0);
            double rightPower = Range.clip(drive - turn, -1.0, 1.0);

            // Send calculated power to wheels
            leftDrive.setPower(leftPower);
            rightDrive.setPower(rightPower);

            // Show the elapsed game time and wheel power.
            telemetry.addData("Status", "Run Time: " + runtime.toString());
            telemetry.addData("Motors", "left (%.2f), right (%.2f)", leftPower, rightPower);
            telemetry.update();
        }
    }
}
`,
                                      },
                                      {
                                        id: "ftc-basic-auto",
                                        name: "BasicAutonomous.java",
                                        type: "file",
                                        language: "java",
                                        content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.util.ElapsedTime;

/**
 * Basic autonomous OpMode.
 * Based on FTC SDK samples from:
 * https://github.com/FIRST-Tech-Challenge/FtcRobotController
 */

@Autonomous(name = "Basic: Autonomous", group = "Autonomous")
public class BasicAutonomous extends LinearOpMode {

    private DcMotor leftDrive  = null;
    private DcMotor rightDrive = null;
    private ElapsedTime runtime = new ElapsedTime();

    static final double FORWARD_SPEED = 0.6;
    static final double TURN_SPEED    = 0.5;

    @Override
    public void runOpMode() {
        leftDrive  = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");

        leftDrive.setDirection(DcMotor.Direction.REVERSE);
        rightDrive.setDirection(DcMotor.Direction.FORWARD);

        telemetry.addData("Status", "Ready to run");
        telemetry.update();

        waitForStart();

        // Step 1: Drive forward for 3 seconds
        leftDrive.setPower(FORWARD_SPEED);
        rightDrive.setPower(FORWARD_SPEED);
        runtime.reset();
        while (opModeIsActive() && (runtime.seconds() < 3.0)) {
            telemetry.addData("Path", "Step 1: %4.1f S Elapsed", runtime.seconds());
            telemetry.update();
        }

        // Step 2: Spin right for 1.3 seconds
        leftDrive.setPower(TURN_SPEED);
        rightDrive.setPower(-TURN_SPEED);
        runtime.reset();
        while (opModeIsActive() && (runtime.seconds() < 1.3)) {
            telemetry.addData("Path", "Step 2: %4.1f S Elapsed", runtime.seconds());
            telemetry.update();
        }

        // Step 3: Drive forward for 1 second
        leftDrive.setPower(FORWARD_SPEED);
        rightDrive.setPower(FORWARD_SPEED);
        runtime.reset();
        while (opModeIsActive() && (runtime.seconds() < 1.0)) {
            telemetry.addData("Path", "Step 3: %4.1f S Elapsed", runtime.seconds());
            telemetry.update();
        }

        // Step 4: Stop
        leftDrive.setPower(0);
        rightDrive.setPower(0);

        telemetry.addData("Path", "Complete");
        telemetry.update();
        sleep(1000);
    }
}
`,
                                      },
                                      {
                                        id: "ftc-mecanum",
                                        name: "MecanumTeleOp.java",
                                        type: "file",
                                        language: "java",
                                        content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorSimple;

/**
 * Mecanum drive TeleOp using the official FTC SDK patterns.
 * Implements field-centric-ready mecanum with proper motor math.
 */

@TeleOp(name = "Mecanum TeleOp", group = "TeleOp")
public class MecanumTeleOp extends LinearOpMode {

    @Override
    public void runOpMode() {
        DcMotor frontLeft  = hardwareMap.get(DcMotor.class, "front_left");
        DcMotor frontRight = hardwareMap.get(DcMotor.class, "front_right");
        DcMotor backLeft   = hardwareMap.get(DcMotor.class, "back_left");
        DcMotor backRight  = hardwareMap.get(DcMotor.class, "back_right");

        frontLeft.setDirection(DcMotorSimple.Direction.REVERSE);
        backLeft.setDirection(DcMotorSimple.Direction.REVERSE);

        frontLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        frontRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backLeft.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        backRight.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);

        telemetry.addData("Status", "Initialized");
        telemetry.update();

        waitForStart();

        while (opModeIsActive()) {
            double y  = -gamepad1.left_stick_y;  // forward/back
            double x  =  gamepad1.left_stick_x * 1.1; // strafe (counteract imperfect strafing)
            double rx =  gamepad1.right_stick_x; // rotation

            double denominator = Math.max(Math.abs(y) + Math.abs(x) + Math.abs(rx), 1);
            double flPower = (y + x + rx) / denominator;
            double frPower = (y - x - rx) / denominator;
            double blPower = (y - x + rx) / denominator;
            double brPower = (y + x - rx) / denominator;

            frontLeft.setPower(flPower);
            frontRight.setPower(frPower);
            backLeft.setPower(blPower);
            backRight.setPower(brPower);

            telemetry.addData("FL Power", flPower);
            telemetry.addData("FR Power", frPower);
            telemetry.addData("BL Power", blPower);
            telemetry.addData("BR Power", brPower);
            telemetry.update();
        }
    }
}
`,
                                      },
                                      {
                                        id: "ftc-hardware-map",
                                        name: "RobotHardware.java",
                                        type: "file",
                                        language: "java",
                                        content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.hardware.IMU;
import com.qualcomm.hardware.rev.RevHubOrientationOnRobot;

/**
 * Centralized hardware class following FTC SDK best practices.
 * Initialize once, share across all OpModes.
 * 
 * Based on patterns from:
 * https://github.com/FIRST-Tech-Challenge/FtcRobotController
 */
public class RobotHardware {

    // Drive motors
    public DcMotor leftFront  = null;
    public DcMotor rightFront = null;
    public DcMotor leftBack   = null;
    public DcMotor rightBack  = null;

    // Manipulator
    public DcMotor armMotor   = null;
    public Servo   clawServo  = null;

    // Sensors
    public IMU imu = null;

    // Constants
    public static final double CLAW_OPEN  = 0.6;
    public static final double CLAW_CLOSE = 0.0;
    public static final double ARM_SPEED  = 0.5;

    private HardwareMap hwMap = null;

    public void init(HardwareMap ahwMap) {
        hwMap = ahwMap;

        // Drive motors
        leftFront  = hwMap.get(DcMotor.class, "front_left");
        rightFront = hwMap.get(DcMotor.class, "front_right");
        leftBack   = hwMap.get(DcMotor.class, "back_left");
        rightBack  = hwMap.get(DcMotor.class, "back_right");

        leftFront.setDirection(DcMotor.Direction.REVERSE);
        leftBack.setDirection(DcMotor.Direction.REVERSE);
        rightFront.setDirection(DcMotor.Direction.FORWARD);
        rightBack.setDirection(DcMotor.Direction.FORWARD);

        leftFront.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        rightFront.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        leftBack.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        rightBack.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);

        // Arm & claw
        armMotor  = hwMap.get(DcMotor.class, "arm");
        armMotor.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        clawServo = hwMap.get(Servo.class, "claw");

        // IMU (REV Control Hub built-in)
        imu = hwMap.get(IMU.class, "imu");
        IMU.Parameters parameters = new IMU.Parameters(
            new RevHubOrientationOnRobot(
                RevHubOrientationOnRobot.LogoFacingDirection.UP,
                RevHubOrientationOnRobot.UsbFacingDirection.FORWARD
            )
        );
        imu.initialize(parameters);
    }

    public void mecanumDrive(double drive, double strafe, double rotate) {
        double fl = drive + strafe + rotate;
        double fr = drive - strafe - rotate;
        double bl = drive - strafe + rotate;
        double br = drive + strafe - rotate;

        double max = Math.max(Math.max(Math.abs(fl), Math.abs(fr)),
                              Math.max(Math.abs(bl), Math.abs(br)));
        if (max > 1.0) {
            fl /= max; fr /= max; bl /= max; br /= max;
        }

        leftFront.setPower(fl);
        rightFront.setPower(fr);
        leftBack.setPower(bl);
        rightBack.setPower(br);
    }

    public void stopMotors() {
        leftFront.setPower(0);
        rightFront.setPower(0);
        leftBack.setPower(0);
        rightBack.setPower(0);
    }
}
`,
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: "ftc-teamcode-build",
            name: "build.gradle",
            type: "file",
            language: "groovy",
            content: `// TeamCode build.gradle — matches official FtcRobotController structure
// https://github.com/FIRST-Tech-Challenge/FtcRobotController

apply plugin: 'com.android.library'

android {
    compileSdkVersion 34

    defaultConfig {
        minSdkVersion 24
        targetSdkVersion 28
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation project(':FtcRobotController')
    implementation 'org.firstinspires.ftc:RobotCore:10.1.0'
    implementation 'org.firstinspires.ftc:Hardware:10.1.0'
    implementation 'org.firstinspires.ftc:FtcCommon:10.1.0'
    implementation 'org.firstinspires.ftc:Vision:10.1.0'
    implementation 'org.firstinspires.ftc:Inspection:10.1.0'
}
`,
          },
        ],
      },
      {
        id: "ftc-controller",
        name: "FtcRobotController",
        type: "folder",
        children: [
          {
            id: "ftc-controller-build",
            name: "build.gradle",
            type: "file",
            language: "groovy",
            content: `// FtcRobotController module build.gradle
// This module contains the robot controller app and SDK samples.
// See: https://github.com/FIRST-Tech-Challenge/FtcRobotController

apply plugin: 'com.android.application'

android {
    compileSdkVersion 34
    namespace 'com.qualcomm.ftcrobotcontroller'

    defaultConfig {
        applicationId 'com.qualcomm.ftcrobotcontroller'
        minSdkVersion 24
        targetSdkVersion 28
        versionCode 10
        versionName "10.1"
    }
}

dependencies {
    implementation 'org.firstinspires.ftc:RobotCore:10.1.0'
    implementation 'org.firstinspires.ftc:Hardware:10.1.0'
    implementation 'org.firstinspires.ftc:FtcCommon:10.1.0'
    implementation 'org.firstinspires.ftc:Inspection:10.1.0'
    implementation 'org.firstinspires.ftc:OnBotJava:10.1.0'
}
`,
          },
        ],
      },
      {
        id: "ftc-root-build",
        name: "build.gradle",
        type: "file",
        language: "groovy",
        content: `// Top-level build file for FTC Robot Controller project
// Based on: https://github.com/FIRST-Tech-Challenge/FtcRobotController
//
// Cloud build handles compilation — this file is informational.

buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.2.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url 'https://maven.brott.dev/' }
    }
}
`,
      },
      {
        id: "ftc-gradle-properties",
        name: "gradle.properties",
        type: "file",
        language: "properties",
        content: `# Project-wide Gradle settings.
# FTC Robot Controller — SDK 10.1
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx4096m
`,
      },
      {
        id: "ftc-settings-gradle",
        name: "settings.gradle",
        type: "file",
        language: "groovy",
        content: `include ':FtcRobotController'
include ':TeamCode'
`,
      },
      {
        id: "ftc-readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# FTC Robot Controller Project

This project is based on the official **FIRST Tech Challenge SDK** from:
https://github.com/FIRST-Tech-Challenge/FtcRobotController

## Project Structure

\`\`\`
FtcRobotController/
├── TeamCode/                    ← Your team's code goes here
│   ├── src/main/java/org/firstinspires/ftc/teamcode/
│   │   ├── BasicOpMode_Linear.java   ← Basic tank drive TeleOp
│   │   ├── BasicAutonomous.java      ← Simple time-based autonomous
│   │   ├── MecanumTeleOp.java        ← Mecanum drive TeleOp
│   │   └── RobotHardware.java        ← Centralized hardware mapping
│   └── build.gradle
├── FtcRobotController/          ← SDK Robot Controller app
│   └── build.gradle
├── build.gradle                 ← Top-level build config
├── settings.gradle
└── gradle.properties
\`\`\`

## Getting Started

1. Edit OpModes in \`TeamCode/src/main/java/org/firstinspires/ftc/teamcode/\`
2. Click **Build** in the FTC panel to compile in the cloud
3. Connect your Control Hub or phone via USB
4. Click **Upload** to push via ADB

## Hardware Configuration

Make sure your Robot Controller's hardware map matches the names used in code:

### Tank Drive (BasicOpMode_Linear)
- \`left_drive\` / \`right_drive\`

### Mecanum Drive (MecanumTeleOp / RobotHardware)
- \`front_left\` / \`front_right\` / \`back_left\` / \`back_right\`

### Manipulator (RobotHardware)
- \`arm\` (DcMotor) / \`claw\` (Servo)

### Sensors
- \`imu\` (built-in REV Hub IMU)

## FTC SDK Version
This project targets **FTC SDK 10.1** (2024-2025 INTO THE DEEP season).
`,
      },
    ],
  },
];
