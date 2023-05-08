/* Logic for the main page */

function goTo(page) {
	// Home
	$(".home").toggleClass("active", page == "home");
	$("#div_home").toggleClass("hidden", page != "home");

	// EMF Calculator
	$(".emf").toggleClass("active", page == "emf");
	$("#div_emf").toggleClass("hidden", page != "emf");
}


/* EMF Calculator */

var motorPresets = [
	{
		name: "JK42HS34-1334",
		stepAngle: 1.8,
		ratedTorque: 25.5,
		ratedCurrent: 1330,
		resistance: 2.1,
		inductance: 2.5
	},
	{
		name: "17HS19-1684S",
		stepAngle: 1.8,
		ratedTorque: 45,
		ratedCurrent: 1680,
		resistance: 1.65,
		inductance: 2.8
	},
	{
		name: "17HS19-2004S",
		stepAngle: 1.8,
		ratedTorque: 59,
		ratedCurrent: 2000,
		resistance: 1.4,
		inductance: 3.0
	},
	{
		name: "17HM19-1684S",
		stepAngle: 0.9,
		ratedTorque: 44,
		ratedCurrent: 1680,
		resistance: 1.65,
		inductance: 4.1
	},
	{
		name: "17HM19-2004S",
		stepAngle: 0.9,
		ratedTorque: 46,
		ratedCurrent: 2000,
		resistance: 1.4,
		inductance: 3.0
	}
];

$(document).ready(function() {
	calcStepsPerMm();
	calcEmf();
});

$("#step_angle, #motor_properties input").change(function() {
	$("#motor_preset").val("custom");
});

$("#motor_preset").change(function() {
	var preset = $(this).val();
	for(var i = 0; i < motorPresets.length; i++) {
		if (motorPresets[i].name == preset) {
			$("#step_angle").val(motorPresets[i].stepAngle);
			$("#rated_torque").val(motorPresets[i].ratedTorque);
			$("#rated_current").val(motorPresets[i].ratedCurrent);
			$("#resistance").val(motorPresets[i].resistance);
			$("#inductance").val(motorPresets[i].inductance);
		}
	}
});

// Steps/mm calculator
$("#step_angle, #microstepping, .step-calculator input, .step-calculator select").change(calcStepsPerMm);

$("#div_emf input, #div_emf select").change(function() {
	calcEmf();
});

$('input[name="steps_type"]').change(function() {
	var isBelt = $('input[name="steps_type"]:checked').val() == "belt";
	$("#div_belt").toggleClass("hidden", !isBelt);
	$("#div_leadscrew").toggleClass("hidden", isBelt);

	calcStepsPerMm();
});

$("#belt_preset").change(function() {
	var value = $(this).val();
	$("#belt_pitch").val(value);

	calcStepsPerMm();
});

$("#belt_pitch").change(function() {
	var option = $('#belt_preset > option[value="' + $(this).val() + '"]');
	$("#belt_preset").val(option.length == 0 ? "custom" : $(this).val());
});

$("#leadscrew_preset").change(function() {
	var value = $(this).val();
	$("#leadscrew_lead").val(value);

	calcStepsPerMm();
});

$("#leadscrew_lead").change(function() {
	var option = $('#leadscrew_preset > option[value="' + $(this).val() + '"]');
	$("#leadscrew_preset").val(option.length == 0 ? "custom" : $(this).val());
});

var distancePerRevolution = 40, fullStepsPerMm = 0;

function calcStepsPerMm() {
	var stepsPerMm = NaN;
	var microstepping = parseInt($("#microstepping").val());
	var stepAngle = $("#step_angle").val();

	var isBelt = $('input[name="steps_type"]:checked').val() == "belt";
	if (isBelt) {
		if ($("#belt_pitch:invalid, #pulley_teeth:invalid").length == 0) {
			var beltPitch = $("#belt_pitch").val();
			var pulleyTeeth = $("#pulley_teeth").val();
			distancePerRevolution = pulleyTeeth * beltPitch;
			fullStepsPerMm = 360.0 / (distancePerRevolution * stepAngle);
			stepsPerMm = (360.0 * microstepping) / (distancePerRevolution * stepAngle);
		}
	} else {
		if ($("#leadscrew_lead:invalid, #gear_ratio_1:invalid, #gear_ratio_2:invalid").length == 0) {
			var leadscrewLead = $("#leadscrew_lead").val();
			var ratio = $("#gear_ratio_2").val() / $("#gear_ratio_1").val();
			distancePerRevolution = ratio * leadscrewLead;
/*See https://forum.duet3d.com/topic/6852/bug-in-emf-calculator */
			fullStepsPerMm = (360.0) / (distancePerRevolution * stepAngle);
			stepsPerMm = (360.0 * microstepping) / (distancePerRevolution * stepAngle);
		}
	}

	if (!isFinite(stepsPerMm)) {
		distancePerRevolution = stepsPerMm = NaN;
	} else {
		$("#steps_per_mm").val(stepsPerMm.toFixed(3));
	}
}

$("#steps_per_mm").change(function() {
	var microstepping = parseInt($("#microstepping").val());
	var stepAngle = parseFloat($("#step_angle").val());
	var stepsPerMm = parseFloat($(this).val());

	var isBelt = $('input[name="steps_type"]:checked').val() == "belt";
	if (isBelt) {
		distancePerRevolution = (360.0 * microstepping) / (stepsPerMm * stepAngle);
	} else {
		distancePerRevolution = (stepAngle * stepsPerMm) / (360.0 * microstepping);
	}

	if (!isFinite(stepsPerMm)) {
		distancePerRevolution = stepsPerMm = NaN;
	} else {
		$(this).val(stepsPerMm.toFixed(3));
	}

	calcEmf();
});

// EMF calculation
$("#div_emf input, #div_emf select").change(function() {
	if ($(this).parents(".step-calculation").length == 0) {
		// The step calculator calls this anyway, no need to call it twice
		calcEmf();
	}
});

function calcEmf() {
	// Get inputs
	var geometryFactor = parseFloat($("#geometry").val());
	var supplyVoltage = parseFloat($("#supply_voltage").val());
	var requestedMaxSpeed = parseFloat($("#requested_max_speed").val());
	var numMotors = parseInt($("#num_motors").val());

	var stepAngle = parseFloat($("#step_angle").val());
	var stepsPerRevolution = 360.0 / stepAngle;
	var motorCurrent = parseFloat($("#motor_current").val()) / 1000.0;
	var ratedTorque = parseFloat($("#rated_torque").val()) / 100.0;
	var ratedCurrent = parseFloat($("#rated_current").val()) / 1000.0;
	var resistance = parseFloat($("#resistance").val());
	var inductance = parseFloat($("#inductance").val()) / 1000.0;
	var driverVoltageDrop = 1;		// typical value is 1V

	var microstepping = parseInt($("#microstepping").val());
	var stepsPerMm = parseFloat($("#steps_per_mm").val());
	
	// Calculate voltage drop
	var voltageDrop = NaN;
	if (!isNaN(resistance) && !isNaN(motorCurrent)) {
		voltageDrop = resistance * motorCurrent + driverVoltageDrop;
	}

	// Calculate max speeds
	var maxSpeedLowSlip = NaN, maxSpeedHighSlip = NaN;
	var maxFreqLowSlip = NaN, maxFreqHighSlip = NaN;
	var inductiveBackEmfPerRevSec = "n/a";
	var rotationBackEmf = NaN, inductiveBackEmf = NaN;
	if (!isNaN(motorCurrent) && !isNaN(inductance) && !isNaN(stepAngle) && !isNaN(supplyVoltage) && !isNaN(ratedTorque) && !isNaN(ratedCurrent) && !isNaN(voltageDrop) && !isNaN(stepsPerMm)) {
		var inductiveBackEmfPerRevSec = Math.PI * motorCurrent * inductance * 180.0 / stepAngle;
		var motionBackEmfPerRevSec = Math.sqrt(2) * Math.PI * ratedTorque / ratedCurrent;
		var revsTorqueDropLowSlip = Math.sqrt(supplyVoltage * supplyVoltage - Math.pow(driverVoltageDrop + voltageDrop, 2)) / ((inductiveBackEmfPerRevSec + motionBackEmfPerRevSec) * numMotors);
		var revsTorqueDropHighSlip = (Math.sqrt(motionBackEmfPerRevSec * motionBackEmfPerRevSec + (motionBackEmfPerRevSec * motionBackEmfPerRevSec + inductiveBackEmfPerRevSec * inductiveBackEmfPerRevSec) * (supplyVoltage * supplyVoltage - Math.pow(voltageDrop + driverVoltageDrop, 2))) - motionBackEmfPerRevSec) / ((motionBackEmfPerRevSec * motionBackEmfPerRevSec + inductiveBackEmfPerRevSec * inductiveBackEmfPerRevSec) * numMotors);
		var microstepsPerSecTorqueDropLowSlip = revsTorqueDropLowSlip * stepsPerRevolution * microstepping;
		var microstepsPerSecTorqueDropHighSlip = revsTorqueDropHighSlip * stepsPerRevolution * microstepping;
		var revsPerSec = requestedMaxSpeed * geometryFactor * (stepsPerMm / microstepping) * (stepAngle / 360);

		/*console.log("inductiveBackEmfPerRevSec: " + inductiveBackEmfPerRevSec);
		console.log("motionBackEmfPerRevSec: " + motionBackEmfPerRevSec + " ratedTorque: " + ratedTorque + " ratedCurrent: " + ratedCurrent);
		console.log("revsTorqueDropLowSlip: " + revsTorqueDropLowSlip);
		console.log("revsTorqueDropHighSlip: " + revsTorqueDropHighSlip);
		console.log("microstepsPerSecTorqueDropLowSlip: " + microstepsPerSecTorqueDropLowSlip);
		console.log("microstepsPerSecTorqueDropHighSlip: " + microstepsPerSecTorqueDropHighSlip);
		console.log("revsPerSec: " + revsPerSec);*/

		maxSpeedLowSlip = microstepsPerSecTorqueDropLowSlip / (stepsPerMm * geometryFactor);
		maxFreqLowSlip = maxSpeedLowSlip * stepsPerMm * geometryFactor / 1000.0;
		maxSpeedHighSlip = microstepsPerSecTorqueDropHighSlip / (stepsPerMm * geometryFactor);
		maxFreqHighSlip = maxSpeedHighSlip * stepsPerMm * geometryFactor / 1000.0;

		rotationBackEmf = revsPerSec * motionBackEmfPerRevSec;
		if (rotationBackEmf < supplyVoltage) {
			rotationBackEmf = '<span class="text-success">' + rotationBackEmf.toFixed(1) + ' V</span> at ' + requestedMaxSpeed.toFixed(1) + ' mm/s';
		} else {
			rotationBackEmf = '<span class="text-danger">' + rotationBackEmf.toFixed(1) + ' V</span> at ' + requestedMaxSpeed.toFixed(1) + ' mm/s';
		}

		inductiveBackEmf = revsPerSec * inductiveBackEmfPerRevSec;
		if (inductiveBackEmf < supplyVoltage) {
			inductiveBackEmf = '<span class="text-success">' + inductiveBackEmf.toFixed(1) + ' V</span> at ' + requestedMaxSpeed.toFixed(1) + ' mm/s';
		} else {
			inductiveBackEmf = '<span class="text-danger">' + inductiveBackEmf.toFixed(1) + ' V</span> at ' + requestedMaxSpeed.toFixed(1) + ' mm/s';
		}
	}

	// Work out the step frequency
	var stepFrequency = stepsPerMm * requestedMaxSpeed;
	if (isNaN(stepFrequency))
	{
		stepFrequency = 'n/a';
	}
	else if (stepFrequency <= 120000)
	{
		stepFrequency = '<span class="text-success">' + (stepFrequency / 1000).toFixed(1) + ' kHz</span> at ' + requestedMaxSpeed.toFixed(1) + " mm/s";
	}
	else
	{
		stepFrequency = '<span class="text-danger">' + (stepFrequency / 1000).toFixed(1) + ' kHz</span> at ' + requestedMaxSpeed.toFixed(1) + " mm/s";
	}

	// Display results
	$("#generated_emf").html(rotationBackEmf);
	$("#generated_emf_inductance").html(inductiveBackEmf);
	$("#step_frequency").html(stepFrequency);
	$("#max_speed_low").text(isNaN(maxSpeedLowSlip) ? "n/a" : (maxSpeedLowSlip.toFixed(1) + " mm/s @ " + maxFreqLowSlip.toFixed(1) + " kHz"));
	$("#max_speed_high").text(isNaN(maxSpeedHighSlip) ? "n/a" : (maxSpeedHighSlip.toFixed(1) + " mm/s @ " + maxFreqHighSlip.toFixed(1) + " kHz"));
}
