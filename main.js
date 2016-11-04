const context = document.getElementById("canvas").getContext("2d");

const meGuys = [];
const themGuys = [];
const meDestination = new Vector(1200, 0);
const themDestination = new Vector(0, 600);

const lerp = {
	flockGoal: 0.5,
	com: 0.01,
	repel: 0.5
}

const personalSpace = 100;
const repulsionThreshold = 10000;
const repulsionConstant = -100000000;

const actorSize = 20;
const actorMaxSpeed = 10;

const meColor = "blue";
const themColor = "red";

class Actor {
	constructor(position, velocity, destination, color) {
		this.position = position;
		this.velocity = velocity;
		this.maxSpeed = actorMaxSpeed;
		this.size = actorSize;
		this.color = color;
		this.destination = destination;
	}

	CalcVelocity(team, enemies) {
		// Attraction to enter of mass of flock
		let com = new Vector(0, 0);

		for (const teammate of team) {
			if (Vector.dist(teammate.position, this.position) > personalSpace) {
				com.add(Vector.subtract(teammate.position, this.position));
			}
		}
		com.mult(1 / team.length);

		// Repulsion from enemies
		let repulsion = new Vector(0, 0);
		let repulsionCount = 0;

		for (const enemy of enemies) {
			if (Vector.dist(enemy.position, this.position) <= repulsionThreshold) {
				repulsionCount++;
				const direction = Vector.subtract(enemy.position, this.position);
				const distance = direction.mag();
				direction.unit();
				repulsion.add(direction.mult(repulsionConstant / distance ** 4));
			}
		}
		repulsion.mult(1 / Math.max(1, repulsionCount));

		// Go to flock goal
		let flockGoalDrive = Vector.subtract(this.destination, this.position).unit().mult(this.maxSpeed);

		// Do the lerp
		this.velocity = Vector.add(
			com.mult(lerp.com),
			repulsion.mult(lerp.repel),
			flockGoalDrive.mult(lerp.flockGoal)
		).unit().mult(this.maxSpeed);

	}

	Update(deltaTime, team, enemies) {
		this.CalcVelocity(team, enemies);
		const newPosition = Vector.add(this.position, Vector.mult(this.velocity, deltaTime));
		let isColliding = false;
		for (const enemy of enemies) {
			if (Vector.dist(enemy.position, newPosition) <= this.size + enemy.size) {
				isColliding = true;
				break;
			}
		}

		if (isColliding === false) {
			this.position = newPosition;
		}
	}

	Render() {
		context.beginPath();
		context.strokeStyle = this.color;
		context.arc(this.position.x, this.position.y, this.size, 0, 2 * Math.PI);
		context.stroke();
	}
}

let prevTime = null;

function main(curTime) {
	if (prevTime === null) {
		prevTime = curTime;
	}

	const deltaTime = (curTime - prevTime) / 16000;

	for (const meGuy of meGuys) {
		meGuy.Update(deltaTime, meGuys, themGuys);
	}
	for (const themGuy of themGuys) {
		themGuy.Update(deltaTime, themGuys, meGuys);
	}

	context.clearRect(0, 0, 1200, 600);
	for (const meGuy of meGuys) {
		meGuy.Render();
	}
	for (const themGuy of themGuys) {
		themGuy.Render();
	}
	requestAnimationFrame(main);
}

window.addEventListener("mousedown", event => {
	event.preventDefault();
	if (event.button === 0) {
		meGuys.push(new Actor(
			new Vector(event.clientX, event.clientY),
			new Vector(0, 0),
			meDestination,
			meColor
		));
	} else {
		themGuys.push(new Actor(
			new Vector(event.clientX, event.clientY),
			new Vector(0, 0),
			themDestination,
			themColor
		));
	}
});

requestAnimationFrame(main);
window.oncontextmenu = () => false;