import { FileNode } from "@/types/ide";

export const ftcTemplate: FileNode[] = [
  {
    id: "root",
    name: "ftc-project",
    type: "folder",
    children: [
      {
        id: "ftc-teamcode",
        name: "TeamCode",
        type: "folder",
        children: [
          {
            id: "ftc-opmode",
            name: "MyFirstOpMode.java",
            type: "file",
            language: "java",
            content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;
import com.qualcomm.robotcore.hardware.DcMotor;

@TeleOp(name = "My First OpMode", group = "TeleOp")
public class MyFirstOpMode extends LinearOpMode {

    private DcMotor leftDrive  = null;
    private DcMotor rightDrive = null;

    @Override
    public void runOpMode() {
        // Initialize hardware
        leftDrive  = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");

        leftDrive.setDirection(DcMotor.Direction.REVERSE);
        rightDrive.setDirection(DcMotor.Direction.FORWARD);

        telemetry.addData("Status", "Initialized");
        telemetry.update();

        // Wait for the game to start (driver presses PLAY)
        waitForStart();

        // Run until the end of the match (driver presses STOP)
        while (opModeIsActive()) {
            double leftPower  = -gamepad1.left_stick_y;
            double rightPower = -gamepad1.right_stick_y;

            leftDrive.setPower(leftPower);
            rightDrive.setPower(rightPower);

            telemetry.addData("Status", "Running");
            telemetry.addData("Motors", "left (%.2f), right (%.2f)", leftPower, rightPower);
            telemetry.update();
        }
    }
}
`,
          },
          {
            id: "ftc-auto",
            name: "BasicAutonomous.java",
            type: "file",
            language: "java",
            content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;

@Autonomous(name = "Basic Autonomous", group = "Autonomous")
public class BasicAutonomous extends LinearOpMode {

    private DcMotor leftDrive  = null;
    private DcMotor rightDrive = null;

    @Override
    public void runOpMode() {
        leftDrive  = hardwareMap.get(DcMotor.class, "left_drive");
        rightDrive = hardwareMap.get(DcMotor.class, "right_drive");

        leftDrive.setDirection(DcMotor.Direction.REVERSE);
        rightDrive.setDirection(DcMotor.Direction.FORWARD);

        leftDrive.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
        rightDrive.setMode(DcMotor.RunMode.RUN_USING_ENCODER);

        telemetry.addData("Status", "Ready to run");
        telemetry.update();

        waitForStart();

        if (opModeIsActive()) {
            // Drive forward for 2 seconds
            leftDrive.setPower(0.5);
            rightDrive.setPower(0.5);
            sleep(2000);

            // Stop
            leftDrive.setPower(0);
            rightDrive.setPower(0);

            telemetry.addData("Status", "Autonomous Complete");
            telemetry.update();
        }
    }
}
`,
          },
          {
            id: "ftc-hardware",
            name: "RobotHardware.java",
            type: "file",
            language: "java",
            content: `package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.HardwareMap;
import com.qualcomm.robotcore.hardware.Servo;

/**
 * Centralized hardware class.
 * Initialize once, share across all OpModes.
 */
public class RobotHardware {

    // Drive motors
    public DcMotor leftFront  = null;
    public DcMotor rightFront = null;
    public DcMotor leftBack   = null;
    public DcMotor rightBack  = null;

    // Servos
    public Servo clawServo = null;

    private HardwareMap hwMap = null;

    public void init(HardwareMap ahwMap) {
        hwMap = ahwMap;

        leftFront  = hwMap.get(DcMotor.class, "left_front");
        rightFront = hwMap.get(DcMotor.class, "right_front");
        leftBack   = hwMap.get(DcMotor.class, "left_back");
        rightBack  = hwMap.get(DcMotor.class, "right_back");

        leftFront.setDirection(DcMotor.Direction.REVERSE);
        leftBack.setDirection(DcMotor.Direction.REVERSE);
        rightFront.setDirection(DcMotor.Direction.FORWARD);
        rightBack.setDirection(DcMotor.Direction.FORWARD);

        leftFront.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        rightFront.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        leftBack.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);
        rightBack.setZeroPowerBehavior(DcMotor.ZeroPowerBehavior.BRAKE);

        clawServo = hwMap.get(Servo.class, "claw");
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
      {
        id: "ftc-readme",
        name: "README.md",
        type: "file",
        language: "markdown",
        content: `# FTC Robotics Project

This project is set up for **FIRST Tech Challenge** robot programming.

## Project Structure
- \`TeamCode/\` — Your OpModes and hardware classes
  - \`MyFirstOpMode.java\` — Basic TeleOp example
  - \`BasicAutonomous.java\` — Simple autonomous routine
  - \`RobotHardware.java\` — Centralized hardware mapping

## Getting Started
1. Edit OpModes in the TeamCode folder
2. Click **Build** in the FTC panel to compile in the cloud
3. Connect your Control Hub via USB
4. Click **Upload** to push the APK via ADB

## Hardware Configuration
Make sure your Robot Controller's hardware map matches the names used in code:
- \`left_drive\` / \`right_drive\` (2-motor tank)
- \`left_front\` / \`right_front\` / \`left_back\` / \`right_back\` (mecanum)
- \`claw\` (servo)
`,
      },
      {
        id: "ftc-build-config",
        name: "build.gradle",
        type: "file",
        language: "groovy",
        content: `// FTC Build Configuration (informational — cloud build handles this)
// SDK Version: 9.2
// Min SDK: 24
// Target SDK: 28

dependencies {
    implementation 'org.firstinspires.ftc:RobotCore:9.2.0'
    implementation 'org.firstinspires.ftc:Hardware:9.2.0'
    implementation 'org.firstinspires.ftc:FtcCommon:9.2.0'
}
`,
      },
    ],
  },
];
