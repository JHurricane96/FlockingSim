function FindByPositionX(a, searchX, findGreater) {
	let lb = 0;
	let ub = a.length - 1;
	let mid = Math.floor((ub + lb) / 2);

	while (ub >= lb) {
		mid = Math.floor((ub + lb) / 2);
		let midEltX = a[mid].position.x;
		if (midEltX === searchX) {
			return mid;
		} else if (midEltX < searchX) {
			lb = mid + 1;
		} else {
			ub = mid - 1;
		}
	}

	if (ub < 0) {
		return 0;
	} else if (lb > a.length - 1) {
		return a.length - 1;
	} else if (findGreater === true) {
		return lb;
	} else {
		return ub;
	}
}

function SortByPositionX(a) {
	for (let i = 1; i < a.length; ++i) {
		let x = a[i];
		let j = i - 1;
		while (j >= 0 && a[j].position.x > x.position.x) {
			a[j + 1] = a[j];
			j--;
		}
		a[j + 1] = x;
	}
}