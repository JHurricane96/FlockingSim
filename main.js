const context = document.getElementById("canvas").getContext("2d");
const canvasWidth = 1300;
const canvasHeight = 600;

const mapScale = 1;

const meGuys = [];
const themGuys = [];

const lerp = {
	flockGoal: 1,
	com: 0,
	repelTeam: 0,
	repelEnemy: 1
}

const repulsionThresholdTeam = 50 * mapScale;
const repulsionThresholdEnemy = 50 * mapScale;
const repulsionConstant = -(10 ** 6) * (mapScale ** 4);

const interUnitDist = 5 * mapScale;

const actorSize = 10 * mapScale;
const actorMaxSpeed = 10;

const meColor = "blue";
const themColor = "red";

const meDestination = new Vector(canvasWidth + actorSize, -actorSize);
const themDestination = new Vector(-actorSize, canvasHeight + actorSize);

const noOfMesSpawned = 20;
const noOfThemsSpawned = 20;

class Actor {
	constructor(position, velocity, destination, color, isLeader) {
		this.position = position;
		this.velocity = velocity;
		this.maxSpeed = actorMaxSpeed;
		this.size = actorSize;
		this.color = color;
		this.isLeader = isLeader;
		this.destination = destination;
		this.isDead = false;
		this.isInFormation = true;
	}

	CalcVelocity(team, enemies, i) {
		// Attraction to enter of mass of flock and repulsion from close teammates
		let com = new Vector(0, 0);
		let repulsionTeam = new Vector(0, 0);
		let repulsionCountTeam = 0;

		for (const teammate of team) {
			com.add(Vector.subtract(teammate.position, this.position));
			if (Vector.dist(teammate.position, this.position) <= repulsionThresholdTeam) {
				repulsionCountTeam++;
				const direction = Vector.subtract(teammate.position, this.position);
				const distance = direction.mag();
				if (distance === 0) {
					continue;
				}
				direction.unit();
				repulsionTeam.add(direction.mult((repulsionConstant) / distance ** 4));
			}
		}
		com.mult(1 / team.length);
		repulsionTeam.mult(1 / Math.max(1, repulsionCountTeam));
		com = new Vector(0, 0);

		// Repulsion from enemies
		let repulsionEnemy = new Vector(0, 0);
		let repulsionCountEnemy = 0;

		for (const enemy of enemies) {
			if (Vector.dist(enemy.position, this.position) <= repulsionThresholdEnemy) {
				repulsionCountEnemy++;
				const direction = Vector.subtract(enemy.position, this.position);
				const distance = direction.mag();
				direction.unit();
				const repulsion = Vector.mult(direction, repulsionConstant / distance ** 4);
				repulsionEnemy.add(repulsion);
			}
		}
		// repulsionEnemy.mult(1 / Math.max(1, repulsionCountEnemy));
		repulsionEnemy.mult(repulsionCountTeam / Math.max(repulsionCountEnemy, 1));

		// Go to flock goal
		if (this.isLeader === false && repulsionCountEnemy <= 2) {
			this.isInFormation = false;
			const formationSize = Math.ceil(Math.sqrt(team.length));
			let rowNo = 0;
			let colNo = 1;
			let bestPlace = -1;
			let minDist = Infinity;
			for (let j = 1; j < team.length; ++j) {
				colNo = (colNo + 1) % formationSize;
				if (colNo === 0) {
					rowNo++;
				}
				const dist = Vector.dist(
					new Vector((this.size * 2 + interUnitDist) * rowNo, (this.size * 2 + interUnitDist) * colNo),
					this.position
				);
				if (minDist > dist) {
					minDist = dist;
					bestPlace = j;
				}
			}
			rowNo = Math.floor(i / formationSize);
			colNo = i - rowNo * formationSize;
			const relativeDestination = new Vector(
				(this.size * 2 + interUnitDist) * rowNo,
				(this.size * 2 + interUnitDist) * colNo
			);

			const upDirection = new Vector(0, -1);
			const angleToRotate = Vector.angle(
				upDirection,
				Vector.subtract(team[0].destination, team[0].position)
			);
			if (Vector.cross(upDirection, Vector.subtract(team[0].destination, team[0].position)) > 0) {
				relativeDestination.rotate(angleToRotate);
			} else {
				relativeDestination.rotate(-angleToRotate);
			}

			this.destination = Vector.add(
				team[0].position,
				relativeDestination
			);
		} else {
			this.destination = team[0].destination;
		}
		let flockGoalDrive = Vector.subtract(this.destination, this.position).unit().mult(this.maxSpeed);

		// Do the lerp
		this.velocity = Vector.add(
			com.mult(lerp.com),
			repulsionTeam.mult(lerp.repelTeam),
			repulsionEnemy.mult(lerp.repelEnemy),
			flockGoalDrive.mult(lerp.flockGoal)
		).unit().mult(this.maxSpeed);

		if (Vector.dist(this.position, this.destination) <= 5) {
			this.isInFormation = true;
		}
	}

	Update(deltaTime, team, enemies, i) {
		// this.CalcVelocity(team, enemies, i);
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

		if (this.position.x <= -this.size || this.position.x >= canvasWidth + this.size
			|| this.position.y <= -this.size || this.position.y >= canvasHeight + this.size) {
			this.isDead = true;
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

	const deltaTime = (curTime - prevTime) / 160;

	const deadMeGuys = [];
	const deadThemGuys = [];

	let noOfMeFormed = 0;
	let noOfThemFormed = 0;

	meGuys.forEach((meGuy, i) => {
		meGuy.CalcVelocity(meGuys, themGuys, i);
		if (meGuy.isInFormation === false) {
			meGuy.velocity.mult(2);
		} else {
			noOfMeFormed++;
		}
	});

	meGuys.forEach((meGuy, i) => {
		if (noOfMeFormed === meGuys.length) {
			meGuy.velocity.mult(2);
		}
		meGuy.Update(deltaTime, meGuys, themGuys, i);
		if (meGuy.isDead === true) {
			deadMeGuys.push(i);
		}
	});

	themGuys.forEach((themGuy, i) => {
		themGuy.CalcVelocity(themGuys, meGuys, i);
		if (themGuy.isInFormation === false) {
			themGuy.velocity.mult(2);
		} else {
			noOfThemFormed++;
		}
	});

	themGuys.forEach((themGuy, i) => {
		if (noOfThemFormed === themGuys.length) {
			themGuy.velocity.mult(2);
		}
		themGuy.Update(deltaTime, themGuys, meGuys, i);
		if (themGuy.isDead === true) {
			deadThemGuys.push(i);
		}
	});

	for (const deadMeGuy of deadMeGuys) {
		meGuys.splice(deadMeGuy, 1);
	}

	for (const deadThemGuy of deadThemGuys) {
		themGuys.splice(deadThemGuy, 1);
	}

	if (meGuys.length >= 1) {
		meGuys[0].isLeader = true;
		meGuys[0].destination = meDestination;
	}
	if (themGuys.length >= 1) {
		themGuys[0].isLeader = true;
		themGuys[0].destination = themDestination;
	}

	context.clearRect(0, 0, canvasWidth, canvasHeight);
	for (const meGuy of meGuys) {
		meGuy.Render();
	}
	for (const themGuy of themGuys) {
		themGuy.Render();
	}
	prevTime = curTime;
	requestAnimationFrame(main);
}

window.addEventListener("mousedown", event => {
	event.preventDefault();
	if (event.button === 0) {
		for (let i = 0; i < noOfMesSpawned; ++i) {
			meGuys.push(new Actor(
				new Vector(event.clientX, event.clientY),
				new Vector(0, 0),
				meDestination,
				meColor,
				meGuys.length === 0
			));
		}
	} else {
		for (let i = 0; i < noOfThemsSpawned; ++i) {
			themGuys.push(new Actor(
				new Vector(event.clientX, event.clientY),
				new Vector(0, 0),
				themDestination,
				themColor,
				themGuys.length === 0
			));
		}
	}
});

requestAnimationFrame(main);
window.oncontextmenu = () => false;