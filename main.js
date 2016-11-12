const canvas = document.getElementById("canvas")
const context = canvas.getContext("2d");
let canvasWidth = 0;
let canvasHeight = 0;

// The scale of the map
const mapScale = 0.15;

// List of actors
const meGuys = [];
const themGuys = [];

// List of actors sorted by x co-ordinate
const sortedMeGuys = [];
const sortedThemGuys = [];

// Amount that each factor contributes to unit's velocity
const lerp = {
	// Either the final destination or relative position, depending on various factors
	flockGoal: 1,
	// Center of mass of formation. No longer used
	com: 0,
	// Repulsion between teammates
	repelTeam: 0.1,
	// Repulsion between a unit and its enemies
	repelEnemy: 1
}

// Minimum distance that teammates must be from each other to start repelling
const repulsionThresholdTeam = 50 * mapScale;
// Minimum distance that units must be from enemies to start repelling
const repulsionThresholdEnemy = 50 * mapScale;
// Constant used in quartic repulsion equation
const repulsionConstant = -(12 ** 6) * (mapScale ** 4);

// Distance between units in formation
const interUnitDist = 20 * mapScale;
// Maximum permitted deviation a unit can be from its relative position for 
// a team to be considered in fomation
const deviationThreshold = 5 * mapScale;
// Number of enemies that must be near a unit for it to break formation
const noOfEnemiesToBreakFormation = 2;

// Size of actors in pixels
const actorSize = 10 * mapScale;
// Our maximum speed
const meMaxSpeed = 6;
// Their maximum speed
const themMaxSpeed = 6;

// Our units' color
const meColor = "blue";
// Their units' color
const themColor = "red";

// Our destination
let meDestination = new Vector(0, 0);
// Their destination
let themDestination = new Vector(0, 0);

// Function for setting destinations
// Modify this function to set where units will go
function SetDestinations() {
	meDestination = new Vector(canvasWidth + actorSize, -actorSize);
	themDestination = new Vector(-actorSize, canvasHeight + actorSize);
}

// Number of our units spawned on left click
const noOfMesSpawned = 10;
// Number of their units spawned on right click
const noOfThemsSpawned = 10;

class Actor {
	constructor(position, velocity, maxSpeed, destination, color, isLeader) {
		this.position = position;
		this.velocity = velocity;
		this.maxSpeed = maxSpeed;
		this.size = actorSize;
		this.color = color;
		this.isLeader = isLeader;
		this.destination = destination;
		this.isDead = false;
		this.isInFormation = true;
	}

	CalcEnemyRepulsion(sortedEnemies, repulsionCountTeam) {
		let repulsionEnemy = new Vector(0, 0);
		let repulsionCountEnemy = 0;

		const enemyLowerBound = FindByPositionX(sortedEnemies, this.position.x - repulsionThresholdEnemy * 2, true);
		const enemyUpperBound = FindByPositionX(sortedEnemies, this.position.x + repulsionThresholdEnemy * 2, false);

		for (let i = enemyLowerBound; i <= enemyUpperBound; ++i) {
			const enemy = sortedEnemies[i];
			if (Vector.dist(enemy.position, this.position) <= repulsionThresholdEnemy) {
				repulsionCountEnemy++;
				const direction = Vector.subtract(enemy.position, this.position);
				const distance = direction.mag();
				direction.unit();
				const repulsion = Vector.mult(direction, repulsionConstant / distance ** 4);
				repulsionEnemy.add(repulsion);
			}
		}
		return [repulsionEnemy.mult(repulsionCountTeam / Math.max(repulsionCountEnemy, 1)), repulsionCountEnemy];
	}

	CalcVelocity(team, enemies, sortedTeam, sortedEnemies, i) {
		// Attraction to enter of mass of flock and repulsion from close teammates
		let com = new Vector(0, 0);
		let repulsionTeam = new Vector(0, 0);
		let repulsionCountTeam = 0;
		
		const teamLowerBound = FindByPositionX(sortedTeam, this.position.x - repulsionThresholdTeam * 2, true);
		const teamUpperBound = FindByPositionX(sortedTeam, this.position.x + repulsionThresholdTeam * 2, false);
		
		for (let i = teamLowerBound; i <= teamUpperBound; ++i) {
			const teammate = sortedTeam[i];
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

		// Repulsion from enemies
		let repulsionEnemy = new Vector(0, 0);
		let repulsionCountEnemy = 0;
		if (enemies.length > 0) {
			[repulsionEnemy, repulsionCountEnemy] = this.CalcEnemyRepulsion(sortedEnemies, repulsionCountTeam);
		}

		// Go to flock goal
		if (this.isLeader === false && repulsionCountEnemy <= noOfEnemiesToBreakFormation) {
			this.isInFormation = false;
			const formationSize = Math.ceil(Math.sqrt(team.length));
			const rowNo = Math.floor(i / formationSize);
			const colNo = i - rowNo * formationSize;
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

		if (Vector.dist(this.position, this.destination) <= deviationThreshold) {
			this.isInFormation = true;
		}

		// Do the lerp
		this.velocity = Vector.add(
			com.mult(lerp.com),
			repulsionTeam.mult(lerp.repelTeam),
			repulsionEnemy.mult(lerp.repelEnemy),
			flockGoalDrive.mult(lerp.flockGoal)
		).unit().mult(this.maxSpeed);
	}

	IsColliding(sortedEnemies) {
		let isColliding = false;

		const enemyLowerBound = FindByPositionX(sortedEnemies, this.position.x - this.size * 2, true);
		const enemyUpperBound = FindByPositionX(sortedEnemies, this.position.x + this.size * 2, false);

		for (let i = enemyLowerBound; i <= enemyUpperBound; ++i) {
			const enemy = sortedEnemies[i];
			if (Vector.dist(enemy.position, this.position) <= this.size + enemy.size) {
				isColliding = true;
				break;
			}
		}

		return isColliding;
	}

	Update(deltaTime, team, enemies, sortedEnemies, i) {
		const oldPosition = new Vector(this.position.x, this.position.y);
		this.position.add(Vector.mult(this.velocity, deltaTime));

		if (enemies.length > 0 && this.IsColliding(sortedEnemies) === true) {
			this.position = oldPosition;
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

	let meHasLeader = false;
	let themHasLeader = false;

	meGuys.forEach((meGuy, i) => {
		if (meHasLeader === false) {
			meHasLeader = meGuy.isLeader;
		}
		meGuy.CalcVelocity(meGuys, themGuys, sortedMeGuys, sortedThemGuys, i);
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
		meGuy.Update(deltaTime, meGuys, themGuys, sortedThemGuys, i);
		if (meGuy.isDead === true) {
			deadMeGuys.push(i);
		}
	});

	themGuys.forEach((themGuy, i) => {
		if (themHasLeader === false) {
			themHasLeader = themGuy.isLeader;
		}
		themGuy.CalcVelocity(themGuys, meGuys, sortedThemGuys, sortedMeGuys, i);
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
		themGuy.Update(deltaTime, themGuys, meGuys, sortedMeGuys, i);
		if (themGuy.isDead === true) {
			deadThemGuys.push(i);
		}
	});

	if (deadMeGuys.length > 0) {
		meGuys.splice(0, meGuys.length);
		sortedMeGuys.splice(0, sortedMeGuys.length);
	}

	if (deadThemGuys.length > 0) {
		themGuys.splice(0, themGuys.length);
		sortedThemGuys.splice(0, sortedThemGuys.length);
	}

	if (meGuys.length >= 1 && meHasLeader === false) {
		meGuys[0].isLeader = true;
		meGuys[0].destination = meDestination;
	}
	if (themGuys.length >= 1 && themHasLeader === false) {
		themGuys[0].isLeader = true;
		themGuys[0].destination = themDestination;
	}

	SortByPositionX(sortedMeGuys);
	SortByPositionX(sortedThemGuys);

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
			const newMe = new Actor(
				new Vector(event.clientX, event.clientY),
				new Vector(0, 0),
				meMaxSpeed,
				meDestination,
				meColor,
				meGuys.length === 0
			);
			meGuys.push(newMe);
			sortedMeGuys.push(newMe);
		}
	} else {
		for (let i = 0; i < noOfThemsSpawned; ++i) {
			const newThem = new Actor(
				new Vector(event.clientX, event.clientY),
				new Vector(0, 0),
				themMaxSpeed,
				themDestination,
				themColor,
				themGuys.length === 0
			)
			themGuys.push(newThem);
			sortedThemGuys.push(newThem);
		}
	}
});

const ResizeCanvas = (() => {
	let canResize = true;
	return () => {
		if (canResize === true) {
			canvas.width = canvasWidth = window.innerWidth;
			canvas.height = canvasHeight = window.innerHeight;
			SetDestinations();
			canResize = false;
			setTimeout(() => {
				canResize = true;
			}, 1000 / 60);
		}
	}
})()

window.addEventListener("resize", ResizeCanvas);

ResizeCanvas();
requestAnimationFrame(main);
window.oncontextmenu = () => false;