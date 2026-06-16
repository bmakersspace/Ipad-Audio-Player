/* ── State ────────────────────────────────────────────────── */
let library = {};
let currentFolder = null;
let currentTrackIndex = -1;

const player = document.getElementById("audioPlayer");
const iconPlay = document.getElementById("iconPlay");
const iconPause = document.getElementById("iconPause");
const progressFill = document.getElementById("progressFill");
const progressTrack = document.getElementById("progressTrack");
const timeCurrent = document.getElementById("timeCurrent");
const timeDuration = document.getElementById("timeDuration");
const nowPlaying = document.getElementById("nowPlaying");
const nowFolder = document.getElementById("nowFolder");
const errorBanner = document.getElementById("errorBanner");

/* ── Bootstrap ────────────────────────────────────────────── */
fetch("library.json")
  .then((r) => r.json())
  .then((data) => {
    library = data;
    renderFolders();
    const firstFolder = Object.keys(library)[0];
    if (firstFolder) selectFolder(firstFolder);
  })
  .catch(() => {
    document.getElementById("tracks").innerHTML =
      '<p class="empty-state">Could not load library.json.</p>';
  });

/* ── Folder rendering ─────────────────────────────────────── */
const FOLDER_ICONS = {
  Songs: "♪",
};

function renderFolders() {
  const nav = document.getElementById("folders");
  nav.innerHTML = "";

  Object.entries(library).forEach(([folder, tracks]) => {
    const btn = document.createElement("button");
    btn.className = "folder-btn";
    btn.dataset.folder = folder;

    const icon = FOLDER_ICONS[folder] || "◆";
    btn.innerHTML = `
      <span class="folder-icon">${icon}</span>
      <span class="folder-label">${folder}</span>
      <span class="folder-count">${tracks.length}</span>
    `;

    btn.addEventListener("click", () => selectFolder(folder));
    nav.appendChild(btn);
  });
}

/* ── Track rendering ──────────────────────────────────────── */
function selectFolder(folder) {
  currentFolder = folder;
  hideError();

  document.querySelectorAll(".folder-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.folder === folder);
  });

  document.getElementById("folderTitle").textContent = folder;
  const tracks = library[folder] || [];
  document.getElementById("trackCount").textContent =
    `${tracks.length} track${tracks.length !== 1 ? "s" : ""}`;

  const list = document.getElementById("tracks");
  list.innerHTML = "";

  if (!tracks.length) {
    list.innerHTML = '<p class="empty-state">No tracks in this folder.</p>';
    return;
  }

  tracks.forEach((filename, i) => {
    const name = filename.replace(/\.[^.]+$/, "");
    const ext = filename.split(".").pop().toUpperCase();

    const row = document.createElement("div");
    row.className = "track-row";
    row.dataset.index = i;

    row.innerHTML = `
      <span class="track-num">${i + 1}</span>
      <span class="track-play-icon">▶</span>
      <span class="track-name">${name}</span>
      <span class="track-ext">${ext}</span>
    `;

    row.addEventListener("click", () => playTrack(folder, i));
    list.appendChild(row);
  });
}

/* ── Playback ─────────────────────────────────────────────── */
function playTrack(folder, index) {
  const tracks = library[folder];
  if (!tracks || index < 0 || index >= tracks.length) return;

  hideError();

  const filename = tracks[index];
  // Encode each path segment separately so spaces → %20 but slashes stay
  const src =
    "Audio/" + encodeURIComponent(folder) + "/" + encodeURIComponent(filename);

  currentFolder = folder;
  currentTrackIndex = index;

  document.querySelectorAll(".track-row").forEach((r) => {
    r.classList.toggle("playing", parseInt(r.dataset.index) === index);
  });

  const name = filename.replace(/\.[^.]+$/, "");
  nowPlaying.textContent = name;
  nowFolder.textContent = folder;

  // Always reset src so Safari re-fetches
  player.src = "";
  player.src = src;
  player.load();

  // Play after canplay fires — more reliable on Safari/iPad than playing immediately
  const onCanPlay = () => {
    player.removeEventListener("canplay", onCanPlay);
    player.play().catch((err) => {
      showError(`Playback error: ${err.message}`);
      console.error("play() failed:", err);
    });
  };

  player.addEventListener("canplay", onCanPlay);
}

function togglePlay() {
  if (!player.src) return;
  if (player.paused) {
    player.play().catch((err) => showError(`Playback error: ${err.message}`));
  } else {
    player.pause();
  }
}

/* ── Audio events ─────────────────────────────────────────── */
player.addEventListener("play", () => {
  iconPlay.style.display = "none";
  iconPause.style.display = "block";
});

player.addEventListener("pause", () => {
  iconPlay.style.display = "block";
  iconPause.style.display = "none";
});

player.addEventListener("ended", () => {
  iconPlay.style.display = "block";
  iconPause.style.display = "none";
  if (currentFolder) {
    const tracks = library[currentFolder];
    if (currentTrackIndex + 1 < tracks.length) {
      playTrack(currentFolder, currentTrackIndex + 1);
    }
  }
});

player.addEventListener("timeupdate", () => {
  if (!player.duration || isNaN(player.duration)) return;
  const pct = (player.currentTime / player.duration) * 100;
  progressFill.style.width = pct + "%";
  timeCurrent.textContent = formatTime(player.currentTime);
});

player.addEventListener("durationchange", () => {
  if (!isNaN(player.duration)) {
    timeDuration.textContent = formatTime(player.duration);
  }
});

// Catch network/decode errors and surface them visibly
player.addEventListener("error", () => {
  const err = player.error;
  const codes = {
    1: "Load aborted",
    2: "Network error loading audio",
    3: "Audio decode failed",
    4: "Audio format not supported or file not found",
  };
  const msg = err
    ? codes[err.code] || `Error code ${err.code}`
    : "Unknown audio error";
  showError(`${msg} — check the file path and format.`);
  console.error("HTMLMediaElement error:", err);
});

/* ── Progress bar scrubbing ───────────────────────────────── */
progressTrack.addEventListener("click", (e) => {
  if (!player.duration || isNaN(player.duration)) return;
  const rect = progressTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  player.currentTime = pct * player.duration;
});

/* ── Volume ───────────────────────────────────────────────── */
const volSlider = document.getElementById("volumeSlider");
player.volume = parseFloat(volSlider.value);
volSlider.addEventListener("input", (e) => {
  player.volume = parseFloat(e.target.value);
});

/* ── Error banner ─────────────────────────────────────────── */
function showError(msg) {
  errorBanner.textContent = "⚠ " + msg;
  errorBanner.style.display = "block";
}

function hideError() {
  errorBanner.style.display = "none";
}

/* ── Helpers ──────────────────────────────────────────────── */
function formatTime(secs) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
