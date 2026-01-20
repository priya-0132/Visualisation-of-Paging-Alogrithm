let memory = [];
let pageTable = [];
let segments = []; // Stores segments with base and limit
let history = [];
let hits = 0;
let faults = 0;
let frameSize = 1;
let numFrames = 3;
let accessHistory = [];
let fifoPointer = 0;
let chart;
let pageSequence = [];
let currentStep = -1;

function setAlgorithm(algo) {
  window.currentAlgorithm = algo;
}

function initialize() {
  const frameSizeInput = document.getElementById("frameSize");
  const numFramesInput = document.getElementById("numFrames");

  frameSize = parseInt(frameSizeInput.value);
  numFrames = parseInt(numFramesInput.value);

  memory = Array.from({ length: numFrames }, () =>
    new Array(frameSize).fill(null)
  );

  // Initialize segments with dummy data
  segments = [
    { base: 0, limit: 100 },
    { base: 100, limit: 150 },
    { base: 250, limit: 300 },
  ];

  updateSegmentationTable();

  hits = 0;
  faults = 0;
  fifoPointer = 0;
  history = [];
  accessHistory = [];
  updateView();
  log("Memory initialized.");
  updateChart();
}

function log(message, isReplacement = false) {
  const logDiv = document.getElementById("log");
  const entry = document.createElement("div");
  entry.textContent = message;
  logDiv.appendChild(entry);
  logDiv.scrollTop = logDiv.scrollHeight;
  history.push(message);

  if (isReplacement) {
    const arrow = document.createElement("div");
    arrow.className = "replacement-arrow";
    arrow.textContent = "↺ Page Replaced";
    logDiv.appendChild(arrow);
    setTimeout(() => arrow.remove(), 1500);
  }
}

function clearHighlights() {
  const frameElements = document.querySelectorAll(".frame");
  frameElements.forEach((div) => {
    div.classList.remove("hit", "fault");
  });
}

function updateView(highlight = null, page = null) {
  const framesView = document.getElementById("framesView");
  const statsDiv = document.getElementById("stats");
  framesView.innerHTML = "";

  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    for (let slotIndex = 0; slotIndex < frameSize; slotIndex++) {
      const div = document.createElement("div");
      div.className = "frame";

      const slotPage = memory[frameIndex][slotIndex];
      if (slotPage !== null) {
        div.textContent = "Page " + slotPage;
      } else {
        div.textContent = "[Empty]";
      }

      if (highlight && slotPage === page) {
        div.classList.add(highlight); // 'hit' or 'fault'
      }

      div.title = `Frame ${frameIndex}, Slot ${slotIndex}`;
      framesView.appendChild(div);
    }
  }

  const total = hits + faults;
  const hitRatio = total > 0 ? ((hits / total) * 100).toFixed(2) : 0;
  const faultRatio = total > 0 ? ((faults / total) * 100).toFixed(2) : 0;
  statsDiv.innerHTML = `Hits: ${hits}, Faults: ${faults}, Hit Ratio: ${hitRatio}%, Fault Ratio: ${faultRatio}%`;

  updateChart();
}

function playSound(type) {
  const sound = document.getElementById(type + "Sound");
  if (sound) sound.play();
}

function loadPage(page = null) {
  const pageInput = document.getElementById("pageInput");
  if (page === null) {
    page = parseInt(pageInput.value);
  }
  if (isNaN(page)) {
    alert("Please enter a valid page number.");
    return;
  }

  const algo = window.currentAlgorithm || "LRU";
  const flatMemory = memory.flat();

  if (flatMemory.includes(page)) {
    hits++;
    log(`Page ${page} hit.`);
    playSound("hit");

    if (algo === "LRU") {
      const idx = accessHistory.indexOf(page);
      if (idx !== -1) accessHistory.splice(idx, 1);
      accessHistory.push(page);
    }

    updateView("hit", page);
  } else {
    faults++;
    playSound("fault");

    let emptySlot = null;
    outerLoop: for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
      for (let slotIndex = 0; slotIndex < frameSize; slotIndex++) {
        if (memory[frameIndex][slotIndex] === null) {
          emptySlot = [frameIndex, slotIndex];
          break outerLoop;
        }
      }
    }

    if (emptySlot) {
      const [f, s] = emptySlot;
      memory[f][s] = page;
      if (algo === "LRU") accessHistory.push(page);
      log(`Page ${page} loaded into empty slot at Frame ${f}, Slot ${s}.`);
    } else {
      if (algo === "FIFO") {
        const totalSlots = numFrames * frameSize;
        const globalIndex = fifoPointer % totalSlots;
        const frameIndex = Math.floor(globalIndex / frameSize);
        const slotIndex = globalIndex % frameSize;

        const removed = memory[frameIndex][slotIndex];
        memory[frameIndex][slotIndex] = page;
        fifoPointer = (fifoPointer + 1) % totalSlots;

        log(
          `Page ${removed} replaced with ${page} using FIFO at Frame ${frameIndex}, Slot ${slotIndex}.`,
          true
        );
      } else if (algo === "LRU") {
        const lruPage = accessHistory.shift();

        let lruPos = null;
        outer: for (let f = 0; f < numFrames; f++) {
          for (let s = 0; s < frameSize; s++) {
            if (memory[f][s] === lruPage) {
              lruPos = [f, s];
              break outer;
            }
          }
        }

        if (lruPos) {
          const [f, s] = lruPos;
          memory[f][s] = page;
          accessHistory.push(page);
          log(
            `Page ${lruPage} replaced with ${page} using LRU at Frame ${f}, Slot ${s}.`,
            true
          );
        }
      }
    }

    updateView("fault", page);
  }

  updatePageTable();
}

function updateSegmentationTable(){
  const tbody = document.querySelector("#segmentationTable tbody");

  tbody.innerHTML = '';
  segments.forEach((seg, idx) => {
    const row = document.createElement("tr");

    const segmentCell = document.createElement("td");

    segmentCell.textContent = idx;

    const baseCell = document.createElement("td");

    baseCell.textContent = seg.base;

    const limitCell = document.createElement("td");

    limitCell.textContent = seg.limit;

    row.appendChild(segmentCell);
    row.appendChild(baseCell);
    row.appendChild(limitCell);
    tbody.appendChild(row);
  });
}


function loadSequence() {
  const sequenceInput = document.getElementById("sequenceInput");
  const sequence = sequenceInput.value
    .split(",")
    .map((x) => parseInt(x.trim()))
    .filter((x) => !isNaN(x));
  for (let page of sequence) {
    loadPage(page);
  }
}

function prepareSequence() {
  const sequenceInput = document.getElementById("sequenceInput");
  pageSequence = sequenceInput.value
    .split(",")
    .map((x) => parseInt(x.trim()))
    .filter((x) => !isNaN(x));
  currentStep = -1;
  updateStepIndicator();
  resetMemory();
  log("Sequence loaded. Use 'Next' to step through.");
}

function nextStep() {
  if (currentStep + 1 < pageSequence.length) {
    currentStep++;
    loadPage(pageSequence[currentStep]);
    updateStepIndicator();
  } else {
    log("End of sequence reached.");
    clearHighlights(); // Clear highlight colors when done
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    resetMemory();
    for (let i = 0; i <= currentStep; i++) {
      loadPage(pageSequence[i]);
    }
    updateStepIndicator();
  } else {
    log("At beginning of sequence.");
  }
}

function resetMemory() {
  memory = Array.from({ length: numFrames }, () =>
    new Array(frameSize).fill(null)
  );
  hits = 0;
  faults = 0;
  fifoPointer = 0;
  accessHistory = [];
  updateView();
  updateChart();
}

function updateStepIndicator() {
  const stepIndicator = document.getElementById("stepIndicator");
  if (pageSequence.length === 0) {
    stepIndicator.textContent = "";
  } else {
    stepIndicator.textContent = `Step ${currentStep + 1} of ${pageSequence.length}`;
  }
}

function calculatePhysicalAddress(){
  const segment = parseInt(document.getElementById("segmentInput").value);
  const offset = parseInt(document.getElementById("offsetInput").value);

  if (isNaN(segment) || isNaN(offset)) {
    alert("Please enter a valid segment number and offset.");
    return;
  }

  if (segment < 0 ||
      segment >= segments.length ||
      offset < 0 ||
      offset >= segments[segment].limit) {
    alert("Invalid segment or offset.");
    return;
  }

  const physical = segments[segment].base + offset;

  alert(`Physical Address = Base + Offset = ${segments[segment].base} + ${offset} = ${physical}`);
}


function updateChart() {
  const chartCanvas = document.getElementById("chartCanvas");
  const total = hits + faults;
  const data = {
    labels: ["Hit Ratio", "Fault Ratio"],
    datasets: [
      {
        label: "Page Statistics",
        data:
          total > 0 ? [(hits / total) * 100, (faults / total) * 100] : [0, 0],
        backgroundColor: ["#2ecc71", "#e74c3c"],
      },
    ],
  };

  if (chart) {
    chart.data = data;
    chart.update();
  } else {
    chart = new Chart(chartCanvas, {
      type: "bar",
      data: data,
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
          },
        },
      },
    });
  }
}

function updatePageTable() {
  const tableBody = document
    .getElementById("pageTable")
    .getElementsByTagName("tbody")[0];
  tableBody.innerHTML = "";

  memory.forEach((frame, frameIndex) => {
    frame.forEach((page, slotIndex) => {
      if (page !== null) {
        const row = document.createElement("tr");

        const logicalCell = document.createElement("td");
        logicalCell.textContent = page;

        const physicalCell = document.createElement("td");
        physicalCell.textContent = `Frame ${frameIndex}`;

        row.appendChild(logicalCell);
        row.appendChild(physicalCell);
        tableBody.appendChild(row);
      }
    });
  });
}

function togglePageTable() {
  const container = document.getElementById("pageTableContainer");
  if (container.style.display === "none") {
    updatePageTable();
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

function toggleSegmentationTable(){
  const container = document.getElementById("segmentationTableContainer");

  if (container.style.display === "none") {
    updateSegmentationTable();
    container.style.display = "block";
  } else {
    container.style.display = "none";
  }
}

function downloadLog() {
  const blob = new Blob([history.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "memory_log.txt";
  a.click();
  URL.revokeObjectURL(url);
}

