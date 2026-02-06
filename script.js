const baseScriptURL = 'https://script.google.com/macros/s/AKfycbzG9pdG390UHr7OmGqYKBVpAMsEvRxkNxkuHkJaYgRzWpN5ToTfhNWyJ9LjacSg6wRp/exec';



const collectionURL = baseScriptURL + '?sheet=albums2026' ; // Change 'Sheet1' to your tab name
const archiveURL    = baseScriptURL + '?sheet=Sheet3';

let currentSheetMode = 'albums2026'; // Default start value


let scriptURL = collectionURL; 
let currentSort = 'Newest'; 
let globalData = [];
let globalLogData = [];
let ratingKeys = []; // This makes it accessible everywhere
let processedData = [];


// --- COLOR TUNING CONFIG ---
const COLOR_ANCHOR = 55;      // The "Base" score. Higher = more generous colors.
const COLOR_SENSITIVITY = 15; // How fast colors change. Higher = more dramatic shifts.
const NEON_THRESHOLD = 90;    // Relative score needed to trigger the Purple Gradient.


// 2. INITIALIZATION
async function init() {
  
  console.time("Init Performance");
  const container = document.getElementById('cardContainer');
  container.innerHTML = `<div class="wave-loader">
    <span></span>
    <span></span>
    <span></span>
    <span></span>
    <span></span>
  </div>`;

  // Determine tab names
  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
  const logTabName = currentSheet + "log";
  const logURL = `${baseScriptURL}?sheet=${logTabName}`;

  // Update Nav UI
  document.getElementById('btn-arc').classList.toggle('active-glow', currentSheet === 'Sheet3');
  document.getElementById('btn-col').classList.toggle('active-glow', currentSheet === 'albums2026');

  try {
    // START BOTH FETCHES AT ONCE
    const [dataRes, logRes] = await Promise.all([
      fetch(scriptURL),
      fetch(logURL)
    ]);

   const data = await dataRes.json();
    
    
    globalData = data;
    
    
let logData = []; 
try {
    logData = await logRes.json();
} catch (e) {
    console.warn("Log data failed to load, but continuing with album data.");
}

    globalLogData = logData;

   if (data.length > 0) {
  // 1. Get ALL headers from the first row
  const allHeaders = Object.keys(data[0]);
  
  // 2. Define our raters (everyone from Column 7 onwards)
  const raters = allHeaders.slice(7);
  
  // 3. Update the global variable if you use it elsewhere
  ratingKeys = raters; 

  // 4. Pass the names to the dropdown builder
  setupDropdown(allHeaders); 
}

    console.log("Log URL:", logURL);
console.log("Raw Log Data:", logData);
console.log("Rating Keys:", ratingKeys);
    // Render everything now that we have all the data
    renderCards(data);
    
    // Pass logData directly into renderAves so it doesn't have to fetch again!
    renderAves(data, logData); 

  } catch (err) {
    console.error("Initialization failed:", err);
  }
  
finally {
    // 2. Stop the timer (placed in 'finally' so it logs even if there is an error)
    console.timeEnd("Init Performance");
  }
}


function switchSheet(mode) {
  
  currentSheetMode = (mode === 'archive') ? 'Sheet3' : 'albums2026';
  // 1. Update the URL
  scriptURL = (mode === 'archive') ? archiveURL : collectionURL;
  
  // 2. Highlight buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-glow'));
  const btnId = (mode === 'archive') ? 'btn-arc' : 'btn-col';
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) activeBtn.classList.add('active-glow');

  // 3. Reset data and reload
  globalData = [];
  init();
}

function setupDropdown(allHeaders) {
  if (!allHeaders || allHeaders.length < 7) {
    console.error("SetupDropdown failed: Not enough columns.");
    return;
  }
  const raters = allHeaders.slice(7);
  
  // 1. Fill the Sort Datalist (SEARCHABLE)
  const sortOptions = document.getElementById('sortOptions');
  if (sortOptions) {
    sortOptions.innerHTML = `
      <option value="Newest">Newest Added</option>
      <option value="Release">Release Date</option>
      <option value="Highest">Overall Average</option>
    `;
    raters.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name; // This is the value that currentSort will get
      sortOptions.appendChild(opt);
    });
  
if (!sortSelect.value) sortSelect.value = "newest";
  }
  // 2. SEARCHABLE: Chooser Datalist (Add Album Form)
  const chooserList = document.getElementById('chooserList');
  if (chooserList) {
    chooserList.innerHTML = ''; 
    raters.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      chooserList.appendChild(opt);
    });
  }

  // 3. SEARCHABLE: Modal Datalist (The Rating Popup)
  const raterList = document.getElementById('raterList');
  if (raterList) {
    raterList.innerHTML = ''; 
    raters.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      raterList.appendChild(opt);
    });
  }
}




async function renderAves(data, logData) {
  // --- DEBUG BLOCK ---
  console.group("Recent Activity Debugger");
  console.log("Raw Data Sample:", data[0]);
  console.log("Raw Log Sample:", logData ? logData[0] : "MISSING");
  console.groupEnd();

  const avesContainer = document.getElementById('averagesforall');
  const graphWrapper = document.getElementById('masterGraphWrapper');
  const recentList = document.getElementById('recentUpdatesList');

  if (!avesContainer || !graphWrapper || data.length === 0) return;

  // Reset containers
  avesContainer.innerHTML = "";
  graphWrapper.innerHTML = "";
  if (recentList) recentList.innerHTML = "<p style='color: #666; font-size: 11px;'>Checking history...</p>";

  const { mean, stdDev } = getGlobalStats(data);
  const currentHeaders = Object.keys(data[0] || {});
  const currentRaters = currentHeaders.slice(7); 

  // --- 1. BUILD THE GLOBAL GRAPH (Untouched) ---
  let allRatings = [];
  data.forEach(item => {
    currentRaters.forEach(key => {
      let val = Number(item[key]);
      if (val > 0) {
        if (val <= 10) val *= 10;
        allRatings.push(val);
      }
    });
  });

  const resolution = 30;
  const buckets = new Array(resolution).fill(0);
  allRatings.forEach(val => {
    const bIndex = Math.min(Math.floor(val / (100 / resolution)), resolution - 1);
    buckets[bIndex]++;
  });

  const maxCount = Math.max(...buckets, 1);
  const graphHeight = 120;
  const graphWidth = 600;

  const stops = [0, 20, 40, 60, 75, 85, 95, 100].map(pct => {
    const stopZ = stdDev > 0 ? (pct - mean) / stdDev : 0;
    const stopColorVal = Math.max(0, Math.min(100, COLOR_ANCHOR + (stopZ * COLOR_SENSITIVITY)));
    let color = getBarColor(stopColorVal);
    if (color.includes('linear-gradient')) color = "#bc13fe";
    return `<stop offset="${pct}%" stop-color="${color}" />`;
  }).join('');

  const pointObjects = buckets.map((count, i) => ({
    x: (i * (graphWidth / (resolution - 1))),
    y: graphHeight - (count / maxCount * (graphHeight - 20))
  }));

  const smoothPathData = solveCurvyPath(pointObjects, graphWidth, graphHeight);

  graphWrapper.innerHTML = `
    <svg viewBox="0 0 ${graphWidth} ${graphHeight}" preserveAspectRatio="none" style="width:100%; height:${graphHeight}px; display:block;">
      <defs><linearGradient id="masterGrad" x1="0%" y1="0%" x2="100%" y2="0%">${stops}</linearGradient></defs>
      <path d="${smoothPathData}" style="stroke: url(#masterGrad); fill: url(#masterGrad); fill-opacity: 0.2; stroke-width: 2;"></path>
    </svg>
  `;

let activity = [];

  if (Array.isArray(logData) && logData.length > 0) {
    const mainHeaders = Object.keys(data[0]); 
const logHeaders = Object.keys(logData[0]); // These are your "Paddy" or "Timestamp" headers

    logHeaders.forEach((headerKey, colIndex) => {
      // Check if the header string itself is a valid timestamp
      const headerDate = new Date(headerKey);
      
      if (!isNaN(headerDate.getTime()) && headerDate.getFullYear() === 2026) {
        const raterName = mainHeaders[colIndex];
        
        if (colIndex >= 7 && raterName) {
          activity.push({
            title: `<strong style="color:gold"> ${raterName} </strong>`,
            artist: "",
            album: "Joined! 🎉 🎉 🎉 ",
            art: "https://cdn-icons-png.flaticon.com/512/1077/1077063.png",
            time: headerDate,
            subtitle: ``
          });
        }
      }
    });
    logData.forEach((logRow, rowIndex) => {
      const mainRow = data[rowIndex];
      if (!mainRow) return;

      const logValues = Object.values(logRow);

      logValues.forEach((cellValue, colIndex) => {
        // Skip Index 0 (Auto-Timestamp) and Index 2 (Chooser)
        if (colIndex === 0 || colIndex === 2) return;

        // Only process if it's a valid timestamp string (ISO format)
        if (cellValue && typeof cellValue === 'string' && cellValue.includes('T')) {
          const timestamp = new Date(cellValue);
          
          if (!isNaN(timestamp.getTime()) && timestamp.getFullYear() === 2026) {
            const colName = mainHeaders[colIndex]; 
            
            let label = "";
            let subText = "";

            // Logic to determine what kind of update this is
            if (colIndex >= 7) {
              label = `<strong style="color:gold">${colName}</strong> rated`;
              subText = `Score: ${mainRow[colName] || 0}`;
            } else if (colName === "Release") {
              label = `<strong style="color:purple">Release Date set </strong>`;
              subText = `Date: ${mainRow.Release.substring(0,10)}`;
            } else if (colName === "Art") {
              label = `<strong style="color:purple">Artwork updated</strong>`;
              subText = `New cover added`;
            } else if (colName === "Comment") {
              label = `<strong style="color:purple">New review added</strong>`;
              subText = mainRow.Comment ? `"${mainRow.Comment.substring(0, 35)}..."` : "Comment added";
            } else {
              // Catch-all for Artist/Album name changes
              label = `${colName} updated`;
              subText = mainRow[colName];
            }

            activity.push({
              title: label,
              artist: mainRow.Artist || "Unknown",
              album: mainRow.Album || "Unknown",
              art: mainRow.Art || "",
              time: timestamp,
              subtitle: subText
            });
          }
        }
      }); // End logValues loop
    }); // End logData loop
  }
  
  // --- 3. RENDER THE TOP 3 ---
 const topUpdates = activity.sort((a, b) => b.time - a.time).slice(0, 5);

  if (recentList) {
    recentList.innerHTML = topUpdates.length ? "" : "<p style='color: #666; font-size: 11px;'>No recent updates.</p>";
    topUpdates.forEach(item => {
      const row = document.createElement('div');
      row.className = 'update-row';
      row.innerHTML = `
        <img src="${item.art}" class="mini-art" onerror="this.src='https://cdn-icons-png.flaticon.com/512/26/26356.png'">
        <div class="update-info">
          <span class="update-title">${item.title}: <strong>${item.artist} - ${item.album}</strong></span>
          <span class="update-subtitle">${item.subtitle} — ${timeAgo(item.time)}</span>
        </div>
      `;
      recentList.appendChild(row);
    });
  }
  // --- 3. RENDER THE INDIVIDUAL USER CARDS (Untouched) ---
  currentRaters.forEach(key => {
    let count = 0, total = 0;
    data.forEach(item => {
      let val = Number(item[key]);
      if (val > 0) {
        if (val <= 10) val *= 10;
        total += val;
        count++;
      }
    });

    const aveScorepres = count > 0 ? Math.round(total / count) : 0;
    const zScore = stdDev > 0 ? (aveScorepres - mean) / stdDev : 0;
    const colorValue = Math.max(0, Math.min(100, COLOR_ANCHOR + (zScore * COLOR_SENSITIVITY)));
    const color = getBarColor(colorValue);

    const aveCard = document.createElement('div');
    aveCard.className = 'aveCard';
    aveCard.style.background = color;
    aveCard.innerHTML = `
      <p class="aveNamesL">${key}</p>
      <p class="aveNamesS">${key.substring(0,3)}</p>
      <p class="aveScores">${aveScorepres}</p>
      <p class="aveCount">${count}</p>
    `;
    avesContainer.appendChild(aveCard);
  });
}



function updateSliderStyle(el, val) {
  // 1. Get stats to determine what this 'val' means relatively
  const { mean, stdDev } = getGlobalStats(globalData);
  
  // 2. Calculate the relative color value
  const zScore = stdDev > 0 ? (val - mean) / stdDev : 0;
const colorValue = Math.max(0, Math.min(100, COLOR_ANCHOR + (zScore * COLOR_SENSITIVITY)));
  const color = getBarColor(colorValue);
  
  // 3. Apply the gradient to the track
  if (color.includes('linear-gradient')) {
    // If it's a neon/purple score, we show a nice green-to-purple transition
    el.style.background = `linear-gradient(90deg, #2ecc71 0%, #bc13fe ${val}%, #222 ${val}%)`;
  } else {
    el.style.background = `linear-gradient(90deg, ${color} ${val}%, #222 ${val}%)`;
  }
  
  return color; // Return for use in the output box
}


function solveCurvyPath(points, width, height) {
    if (points.length < 2) return "";
    
    // Move to the first point
    let d = `M ${points[0].x},${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
        const curr = points[i];
        const next = points[i + 1];
        const mx = (curr.x + next.x) / 2;
        const my = (curr.y + next.y) / 2;
        d += ` Q ${curr.x},${curr.y} ${mx},${my}`;
    }
    
    // Use the width and height passed into the function
    const last = points[points.length - 1];
    d += ` L ${last.x},${last.y} L ${width},${height} L 0,${height} Z`;
    return d;
}



function getGlobalStats(data) {
    let allScores = [];
    data.forEach(item => {
        ratingKeys.forEach(key => {
            let val = Number(item[key]) || 0;
            if (val > 0) {
                if (val <= 10) val *= 10;
                allScores.push(val);
            }
        });
    });
    const mean = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const stdDev = allScores.length > 0 ? Math.sqrt(allScores.map(s => Math.pow(s - mean, 2)).reduce((a, b) => a + b, 0) / allScores.length) : 0;
    return { mean, stdDev };
}


// 5. RENDER CARDS
function renderCards(data) {
    const container = document.getElementById('cardContainer');
    const albumCountEl = document.getElementById('albumCount');

    if (albumCountEl) albumCountEl.innerText = `${data.length} ALBUMS`;
    container.innerHTML = ""; 
    if (!data || data.length === 0) return;

    // 1. GLOBAL SVG DEFINITIONS
    if (!document.getElementById('svg-definitions')) {
        const defContainer = document.createElement('div');
        defContainer.id = 'svg-definitions';
        defContainer.innerHTML = `<svg style="width:0; height:0; position:absolute;"><defs><linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e74c3c" /><stop offset="50%" stop-color="#e67e22" /><stop offset="70%" stop-color="#f1c40f" /><stop offset="85%" stop-color="#2ecc71" /><stop offset="100%" stop-color="#bc13fe" /> </linearGradient></defs></svg>`;
        document.body.appendChild(defContainer);
    }

    const allKeys = Object.keys(data[0]);
    const ratingKeys = allKeys.slice(7);
    let allScores = [];

    // 2. DATA PROCESSING (Calculations & Stats)
    processedData = data.map((item, index) => {
        const ratings = ratingKeys.map(key => {
            let val = Number(item[key]) || 0;
            if (val > 0) {
                if (val <= 10) val *= 10;
                allScores.push(val);
                return val;
            }
            return 0;
        });
        const activeRatings = ratings.filter(v => v > 0);
        const average = activeRatings.length > 0 ? Math.round(activeRatings.reduce((a, b) => a + b, 0) / activeRatings.length) : 0;
        return { ...item, originalRow: index + 2, avgScore: average, fixedRatings: ratings };
    });

    const mean = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
    const stdDev = allScores.length > 0 ? Math.sqrt(allScores.map(s => Math.pow(s - mean, 2)).reduce((a, b) => a + b, 0) / allScores.length) : 0;

    // 3. SORTING LOGIC
    if (currentSort === 'Newest') {
        processedData.reverse();
    } else if (currentSort === 'Highest') {
        processedData.sort((a, b) => b.avgScore - a.avgScore);
    } else if (currentSort === 'Release') {
        processedData.sort((a, b) => {
            const dateA = a.Release ? new Date(a.Release).getTime() : 0;
            const dateB = b.Release ? new Date(b.Release).getTime() : 0;
            return (dateB || 0) - (dateA || 0);
        });
    } else if (currentSort !== 'newest') {
        processedData.sort((a, b) => {
            let vA = (Number(a[currentSort]) <= 10 && Number(a[currentSort]) > 0) ? Number(a[currentSort]) * 10 : Number(a[currentSort]) || 0;
            let vB = (Number(b[currentSort]) <= 10 && Number(b[currentSort]) > 0) ? Number(b[currentSort]) * 10 : Number(b[currentSort]) || 0;
            return vB - vA;
        });
    }

    // 4. CARD CREATOR HELPER
    const createCard = (item, index) => {
        if (!item.Artist && !item.Album) return null;

        const safeArtist = item.Artist ? String(item.Artist) : "Unknown Artist";
        const safeAlbum = item.Album ? String(item.Album) : "Unknown Album";
        const safeRelease = item.Release ? String(item.Release).substring(0, 10) : 'Date';
        const escapedAlbum = safeAlbum.replace(/'/g, "\\'"); 
        const dateID = `release-date-${index}`;
        const imgId = `album-art-${index}`;
        const placeholder = "https://cdn-icons-png.flaticon.com/512/26/26356.png";

        // Scoring & Color
        const zScore = stdDev > 0 ? (item.avgScore - mean) / stdDev : 0;
        const colorValue = Math.max(0, Math.min(100, COLOR_ANCHOR + (zScore * COLOR_SENSITIVITY)));
        const avgColor = getBarColor(colorValue);

        // Graph Logic
        const resolution = 20;
        const buckets = new Array(resolution).fill(0);
        item.fixedRatings.forEach(val => {
            if (val > 0) {
                const bIndex = Math.min(Math.floor(val / (100 / resolution)), resolution - 1);
                buckets[bIndex]++;
            }
        });
        const maxCount = Math.max(...buckets, 1);
        const graphHeight = 100, graphWidth = 200, gradId = `grad-${index}`;
        const stops = [0, 20, 40, 60, 75, 85, 95, 100].map(pct => {
            const stopZ = stdDev > 0 ? (pct - mean) / stdDev : 0;
            const stopColorVal = Math.max(0, Math.min(100, COLOR_ANCHOR + (stopZ * COLOR_SENSITIVITY)));
            let color = getBarColor(stopColorVal);
            if (color.includes('linear-gradient')) color = "#bc13fe";
            return `<stop offset="${pct}%" stop-color="${color}" />`;
        }).join('');
        const pointObjects = buckets.map((count, i) => ({
            x: (i * (graphWidth / (resolution - 1))),
            y: graphHeight - (count / maxCount * (graphHeight - 10))
        }));
        const smoothPathData = solveCurvyPath(pointObjects, graphWidth, graphHeight);

        // Element Creation
        const card = document.createElement('div');
        card.className = 'card card-fade-in';
        card.style.animationDelay = `${(index % 20) * 0.05}s`;
        card.style.opacity = "0";

        card.innerHTML = `
            <div class="hover-glow-backdrop" style="background-image: url('${item.Art || placeholder}')"></div>
            <div class="card-content">
                <div class="artandedit">  
                    <div class="metaname">${item.Chooser || ''}</div>
                    <img src="${item.Art || placeholder}" class="album-art" id="${imgId}" crossorigin="anonymous" loading="lazy">
                    <div>
                        <button class="edit-art-btn" onclick="editArtURL(${item.originalRow})">Edit Art</button>
                        <button class="edit-releaseDate-btn" onclick="editreleaseDate(${item.originalRow})">Edit Date</button>
                    </div>
                    <div class="releaseDate" id="${dateID}">${safeRelease}</div>
                </div>
                <div class="titles">
                    <h3>${safeArtist}</h3>
                    <h4>${safeAlbum}</h4>
                   
                </div>
                <div class="graphandupdate">
                <button class="comments" onclick="addcomment(${item.originalRow})">${item.Comment || "..."}</button>
                
                    <div class="distribution-container" onclick="showScoreList(${index}, event)" style="cursor: pointer;">
                        <svg viewBox="0 0 ${graphWidth} ${graphHeight}" preserveAspectRatio="none" class="dist-svg">
                            <defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">${stops}</linearGradient></defs>
                            <path d="${smoothPathData}" class="dist-path" style="stroke: url(#${gradId}); fill: url(#${gradId});"></path>
                        </svg>
                        <div class="click-hint">View All Scores</div>
                    </div>
                    <div class="rating-trigger-container">
                        <button class="open-rate-btn" onclick="openRatingModal(${item.originalRow}, '${escapedAlbum}', ${index})">Rate Album</button>
                    </div>
                </div>
                <div class="card-actions">
                    <div class="ave" style="background: ${avgColor};">${item.avgScore}</div>
                </div>
                <button class="delete-btn" onclick="confirmDelete(${item.originalRow})">x</button>
            </div>`;

        // iTunes Logic (Delayed)
        const searchTerm = `${safeArtist} ${safeAlbum}`.trim();
        if (!item.Art && searchTerm) {
            // Trigger fetch, but logic inside triggerItunesFetch will handle postponement
            triggerItunesFetch(searchTerm, imgId, dateID, item.originalRow, item.Release);
        }

        return card;
    };

    // 5. THE BATCHED RENDER EXECUTION
    
    // Batch 1: Instant First Row (4 cards)
    const fragmentInitial = document.createDocumentFragment();
    processedData.slice(0, 4).forEach((item, idx) => {
        const card = createCard(item, idx);
        if (card) fragmentInitial.appendChild(card);
    });
    container.appendChild(fragmentInitial);

    // Batch 2: Background Render the Rest
    if (processedData.length > 4) {
        const runner = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
        runner(() => {
            const fragmentRest = document.createDocumentFragment();
            processedData.slice(4).forEach((item, idx) => {
                const card = createCard(item, idx + 4);
                if (card) fragmentRest.appendChild(card);
            });
            container.appendChild(fragmentRest);
            
            console.log(`Render Complete: ${processedData.length} items`);
            setTimeout(initScrollObserver, 100);
        });
    } else {
        setTimeout(initScrollObserver, 100);
    }
}

function triggerItunesFetch(searchTerm, imgId, dateID, originalRow, existingRelease) {
    // 1. Fetch from iTunes (Fast)
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&entity=album&limit=1`)
        .then(res => res.json())
        .then(result => {
            if (result.results.length > 0) {
                const foundArt = result.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                const foundDate = result.results[0].releaseDate.substring(0, 10);
                
                // 2. Update the UI IMMEDIATELY so the user sees the art
                const img = document.getElementById(imgId);
                if (img) img.src = foundArt;
                if (!existingRelease) {
                    const dateEl = document.getElementById(dateID);
                    if (dateEl) dateEl.textContent = foundDate;
                }

                // 3. POSTPONE the Google Sheets update
                // We wait 10 seconds to make sure the initial app load is 100% finished
                setTimeout(() => {
                    const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
                    fetch(baseScriptURL, {
                        method: 'POST', 
                        mode: 'no-cors', 
                        body: JSON.stringify({ 
                            action: "updateArt", 
                            row: originalRow, 
                            artUrl: foundArt, 
                            relDate: foundDate, 
                            sheetMode: currentSheet 
                        })
                    });
                }, 10000); 
            }
        })
        .catch(err => console.warn("iTunes error:", searchTerm));
}
        
// 6. HELPER FUNCTIONS
function getBarColor(val) {
  // Use the global constant for the Elite tier
  if (val >= NEON_THRESHOLD) return "linear-gradient(to top, #2ecc71, #bc13fe)";
  
  if (val >= 82) return "#1abc9c"; // Teal
  if (val >= 65) return "#2ecc71"; // Green
  if (val >= 55) return "#f1c40f"; // Yellow
  if (val >= 45) return "#e67e22"; // Orange
  return "#e74c3c";                // Red
}

function updateBar(id, val) {
  const fill = document.getElementById(`fill-${id}`);
  const valText = document.getElementById(`val-${id}`);
  fill.style.height = val + '%';
  fill.style.background = getBarColor(val);
  valText.innerText = val;
}
function saveCardUpdate(rowNumber, btnElement) {
  const modal = document.getElementById('ratingModal');
  
  // 1. Correctly target the searchable input and the specific modal slider
  const userInput = document.getElementById('modalUserSelect');
  const modalSlider = document.getElementById('modalSlider');

  // 2. Capture the values precisely
  const userName = userInput ? userInput.value : "";
  const score = modalSlider ? modalSlider.value : "0";

  // Debug check - you can remove this after it works
  console.log("Saving Rating:", { name: userName, score: score });

  // 3. Validation
  if (!userName || userName.trim() === "") {
    alert("Please select a name before updating!");
    return;
  }

  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
  btnElement.innerText = "Saving...";

  fetch(baseScriptURL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      action: "updateRating",
      row: rowNumber,
      columnName: userName,
      newScore: score,
      sheetMode: currentSheet
    })
  }).then(() => {
    btnElement.innerText = "Success!";
    setTimeout(() => {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
      init(); 
    }, 1000);
  });
}

function confirmDelete(rowNumber) {
  const password = prompt("Enter security code:");
  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
  if (!password) return;
 fetch(baseScriptURL, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ 
      action: "delete", 
      row: rowNumber, 
      pass: password,
      sheetMode: currentSheet // This tells Google which tab to delete from
    })
  }).then(() => {
    // Refresh the display after deletion
    setTimeout(() => init(), 500);
  });
}

function editArtURL(rowNumber) {
  const newURL = prompt("Paste Image URL:");
  if (!newURL) return;
const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
fetch(baseScriptURL, { // Use baseScriptURL for POST
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({ 
      action: "updateArt", 
      row: rowNumber, 
      artUrl: newURL,
      sheetMode: currentSheet // This tells the Google Script which sheet to use!
    })
  }).then(() => {
    // Give Google a second to process before refreshing
    setTimeout(() => init(), 500);
  });
}



function editreleaseDate(rowNumber) {
  const newreleaseDate = prompt("YYYY-MM-DD");
  if (!newreleaseDate) return;
  
  // Identify which sheet we are on
  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';

  fetch(baseScriptURL, { // Use baseScriptURL for POST
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      action: "updatereleaseDate", 
      row: rowNumber, 
      relDate: newreleaseDate,
      sheetMode: currentSheet // Essential for hitting the right tab
    })
  }).then(() => {
    setTimeout(() => init(), 500);
  });
}

function addcomment(rowNumber) {
  const newcomment = prompt("hot take");
  if (!newcomment) return;

  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';

  fetch(baseScriptURL, { // Use baseScriptURL
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify({
      action: "updateComment", 
      row: rowNumber, 
      newC: newcomment,
      sheetMode: currentSheet
    })
  }).then(() => {
    setTimeout(() => init(), 500);
  });
}

function createForm() {
  // 1. Check if it's already on the screen
  const existingOverlay = document.getElementById('formOverlay');
  if (existingOverlay) {const isClosing = existingOverlay.style.display === 'flex';
    
    existingOverlay.style.display = isClosing ? 'none' : 'flex';
    // If closing, set overflow to auto. If opening, set to hidden.
    document.body.style.overflow = isClosing ? 'auto' : 'hidden';
    return;
  }

  // 2. Create the element
  const submitForm = document.createElement('div');
  submitForm.id = 'formOverlay';
  submitForm.className = 'form-overlay'; // Ensure this CSS has position: fixed
  
  submitForm.innerHTML = `
    <div class="toggle">
      <button class="close-popup" onclick="createForm()">×</button>
      <form id="reviewForm" class="popup-form">
        <input type="text" name="Artist" placeholder="Artist" required>
        <input type="text" name="Album" placeholder="Album" required>
        <input list="chooserList" name="Chooser" id="categoryDropdown" placeholder="User" required>
<datalist id="chooserList"></datalist>
        <button type="submit" id="submitBtn">Submit</button>
      </form>
      <div id="status"></div>
    </div>
  `;

  // 3. Add to page and show
  document.body.appendChild(submitForm);
  submitForm.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // LOCK SCROLL on first create

  if (globalData && globalData.length > 0) {
    setupDropdown(Object.keys(globalData[0]));
  }
  document.getElementById('reviewForm').addEventListener('submit', handleSubmit);
}

function addUserPrompt() {
  const newName = prompt("Enter the name of the new rater:");
  if (!newName) return;

  const url = `${baseScriptURL}?action=addUserGlobal&name=${encodeURIComponent(newName)}`;

  // Use 'no-cors' mode to prevent the redirect error, 
  // OR just handle the response more gracefully.
  fetch(url, { mode: 'no-cors' }) 
  .then(() => {
    alert("User added! Updating data...");
    // Instead of location.reload(), just re-run your init logic
    init(); 
  })
    .catch(err => {
      console.error("Actual error:", err);
      alert("The request failed to send.");
    });
}

function initScrollObserver() {
  const options = {
    root: null, // use the viewport
    rootMargin: '-49% 0px -49% 0px', // Only triggers when in the middle 20% of the screen
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-centered');
      } else {
        entry.target.classList.remove('is-centered');
      }
    });
  }, options);

  // Attach observer to all cards
  document.querySelectorAll('.card').forEach(card => {
    observer.observe(card);
  });
}
// 7. EVENT LISTENERS
window.addEventListener('DOMContentLoaded', init);

document.getElementById('sortSelect').addEventListener('change', function(e) {
  currentSort = e.target.value;
  renderCards(globalData);
});

function manualRefresh() {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('active-glow');
  init();
  setTimeout(() => btn.classList.remove('active-glow'), 1000);
}

function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitBtn');
  const currentSheet = scriptURL.includes('Sheet3') ? 'Sheet3' : 'albums2026';
  
  const myFormData = new FormData(e.target);
  const dataObject = Object.fromEntries(myFormData.entries());
  dataObject.sheetMode = currentSheet;

  submitBtn.innerText = "Sending...";
  submitBtn.disabled = true; // Prevent double-clicks
  
  // We remove mode: 'no-cors' to allow reading the response
  fetch(baseScriptURL, {
    method: 'POST',
    body: JSON.stringify(dataObject)
  })
  .then(response => response.text()) // Get the actual text from doGet/doPost
  .then(result => {
    if (result === "Added") {
      submitBtn.innerText = "Success!";
      submitBtn.style.color = "#2ecc71";
      e.target.reset();

      setTimeout(() => {
        const overlay = document.getElementById('formOverlay');
        if (overlay) overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
        submitBtn.innerText = "Submit";
        submitBtn.style.color = "#666";
        submitBtn.disabled = false;
        init(); 
      }, 1500);
    } else {
      // This is where the "Duplicate found" error shows up
      alert(result);
      submitBtn.innerText = "Submit";
      submitBtn.disabled = false;
    }
  })
  .catch(err => {
    console.error("Submission error:", err);
    alert("Network error, please try again.");
    submitBtn.innerText = "Submit";
    submitBtn.disabled = false;
  });
}
function openRatingModal(rowNumber, albumName, cardIndex) {
  // 1. Standard Modal Setup
  const modal = document.getElementById('ratingModal');
  const albumTitle = document.getElementById('modalAlbumTitle');
  const saveBtn = document.getElementById('modalSaveBtn');
  const slider = document.getElementById('modalSlider');
  const output = document.getElementById('modalSliderValue');
  
  albumTitle.innerText = albumName;

  // 2. The Search Logic (Datalist)
  const datalist = document.getElementById('raterList');
  const userInput = document.getElementById('modalUserSelect');

  userInput.value = ""; 
  datalist.innerHTML = ""; 

  ratingKeys.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    datalist.appendChild(opt);
  });

  // 3. Slider Reset & LIVE Color Logic
  slider.value = 50; // Set to a neutral middle or 0
  output.innerText = slider.value;
  
  // Initialize the color immediately
  const initialColor = updateSliderStyle(slider, slider.value);
  output.style.background = initialColor.includes('linear-gradient') ? "#bc13fe" : initialColor;

  // FIX: This listener was missing! It handles the live movement
  slider.oninput = function() {
    const val = Number(this.value);
    output.innerText = val;
    const currentColor = updateSliderStyle(this, val);
    
    // If it's the "Elite" gradient, make the bubble purple, else match the bar
    if (currentColor.includes('linear-gradient')) {
        output.style.background = "#bc13fe"; 
    } else {
        output.style.background = currentColor;
    }
  };

  // 4. Save & Show
  saveBtn.onclick = () => saveCardUpdate(rowNumber, saveBtn);
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
}


function handleSearch() {
    const query = document.getElementById('albumSearch').value.toLowerCase().trim();
    
    // Filter the global data based on Artist or Album name
    const filteredData = globalData.filter(item => {
        const artist = String(item.Artist || "").toLowerCase();
        const album = String(item.Album || "").toLowerCase();
        return artist.includes(query) || album.includes(query);
    });

    // Re-render with only the matching cards
    renderCards(filteredData);
}


function closeRatingModal() {
  document.getElementById('ratingModal').style.display = 'none';
  document.body.classList.remove('modal-open');
}

function showScoreList(cardIndex) {
    const item = processedData[cardIndex];
    if (!item) return;

    const { mean, stdDev } = getGlobalStats(globalData); // USE CENTRAL STATS

    let scoreRows = "";
    ratingKeys.forEach(key => {
        let val = Number(item[key]);
        if (val > 0) {
            if (val <= 10) val *= 10;
            
            // SYNC COLOR LOGIC
            const zScore = stdDev > 0 ? (val - mean) / stdDev : 0;
           const colorValue = Math.max(0, Math.min(100, COLOR_ANCHOR + (zScore * COLOR_SENSITIVITY)));
            let color = getBarColor(colorValue);
            if (color.includes('linear-gradient')) color = "#bc13fe"; 

            scoreRows += `
                <div class="score-popup-row" data-user="${key.toLowerCase().trim()}">
                    <span class="user-name">${key}</span>
                    <span class="user-val" style="color:${color}">${val}</span>
                </div>`;
        }
    });

    // 3. Render Modal
    const overlay = document.createElement('div');
    overlay.className = 'score-list-overlay';
    overlay.style.zIndex = "20000";
    
   overlay.innerHTML = `
        <div class="score-list-modal" onclick="event.stopPropagation()">
            <button class="close-score-list" onclick="this.closest('.score-list-overlay').remove()">×</button>
            <div class="modal-header">
                <h3 style="margin:0; color:#ffffff; text-align:center">${item.Album}</h3>
                <input type="text" id="userSearch" placeholder="Search user..." autocomplete="off">
            </div>
            <div class="score-rows-container" id="modalBody">
                ${scoreRows}
            </div>
        </div>
    `;
if (window.event) window.event.stopPropagation();
    document.body.appendChild(overlay);

    // 4. Search & Focus Logic
    setTimeout(() => {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('input', function() {
                const term = this.value.toLowerCase().trim();
                const rows = overlay.getElementsByClassName('score-popup-row');
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    const userName = row.getAttribute('data-user') || "";
                    row.style.display = userName.indexOf(term) > -1 ? 'flex' : 'none';
                }
            });
        }
    }, 100);

    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
}

function toggleStatsModal(show) {
  const modal = document.getElementById('statsModal');
  modal.style.display = show ? 'flex' : 'none';
  document.body.style.overflow = show ? 'hidden' : 'auto';
  
  if (show) {
    // Pass BOTH globalData and globalLogData here
    renderAves(globalData, globalLogData); 
    
    setTimeout(updateArrowVisibility, 100);
  }
}


function filterUserAves(term) {
  const lowerTerm = term.toLowerCase().trim();
  const cards = document.querySelectorAll('#averagesforall .aveCard');

  cards.forEach(card => {
    // We look for the name inside the 'aveNamesL' paragraph
    const name = card.querySelector('.aveNamesL').innerText.toLowerCase();
    
    if (name.includes(lowerTerm)) {
      card.style.display = "block"; // Show match
    } else {
      card.style.display = "none";  // Hide others
    }
  });
}





function scrollAves(amount) {
  const container = document.getElementById('averagesforall');
  container.scrollBy({
    left: amount,
    behavior: 'smooth'
  });
}
function updateArrowVisibility() {
  const container = document.getElementById('averagesforall');
  const leftBtn = document.querySelector('.scroll-arrow.left');
  const rightBtn = document.querySelector('.scroll-arrow.right');

  if (!container || !leftBtn || !rightBtn) return;

  const scrollLeft = container.scrollLeft;
  const scrollRight = container.scrollRight;
  const maxScroll = container.scrollWidth - container.clientWidth;

  // Show left arrow only if we've scrolled right
  leftBtn.style.opacity = scrollLeft > 5 ? "1" : "0";
  leftBtn.style.pointerEvents = scrollLeft > 5 ? "auto" : "none";

  // Show right arrow only if there is more content to the right
  rightBtn.style.opacity = scrollLeft < (maxScroll - 5) ? "1" : "0";
  rightBtn.style.pointerEvents = scrollLeft < (maxScroll - 5) ? "auto" : "none";
}
// Attach the listener
document.getElementById('averagesforall').addEventListener('scroll', updateArrowVisibility);
// Run once after rendering
setTimeout(updateArrowVisibility, 500);

function timeAgo(date) {
  if (!date || isNaN(date.getTime())) return "recently";
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  return "just now";
}

const overlay = document.querySelector('.form-overlay');

overlay.addEventListener('click', (event) => {
    // 2. Check if the user clicked the overlay itself
    // (and not the popup box inside it)
    if (event.target === overlay) {
        closePopup(); // Call whatever function you use to hide the popup
    }
});

// Example close function if you don't have one named exactly this:
function closePopup() {
    overlay.style.display = 'none';
    document.body.classList.remove('modal-open');
}


function closeAllPopups() {
    const overlays = document.querySelectorAll('.form-overlay');
    
    overlays.forEach(overlay => {
        // 1. Start the fade out
        overlay.style.opacity = '0';
        
        // 2. Wait for the CSS transition (0.3s) before turning display off
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 300); 
    });
    
    document.body.classList.remove('modal-open');
}

// Universal listener for clicking off a popup
window.addEventListener('click', (e) => {
    const overlayClasses = ['form-overlay', 'score-list-overlay'];
    const overlayIDs = ['ratingModal', 'formOverlay'];

    const isOverlayClass = overlayClasses.some(cls => e.target.classList.contains(cls));
    const isOverlayID = overlayIDs.includes(e.target.id);

    if (isOverlayClass || isOverlayID) {
        // 1. Close static modals by display
        const ratingModal = document.getElementById('ratingModal');
        if (ratingModal) ratingModal.style.display = 'none';
        
        const formOverlay = document.getElementById('formOverlay');
        if (formOverlay) formOverlay.style.display = 'none';

        // 2. Remove dynamic score list from DOM
        const scoreList = document.querySelector('.score-list-overlay');
        if (scoreList) scoreList.remove();
        
        // 3. Reset UI state
        document.body.style.overflow = 'auto';
        document.body.classList.remove('modal-open');
    }
});

// Also add the Escape key for convenience
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeRatingModal();
        const formOverlay = document.getElementById('formOverlay');
        if (formOverlay) formOverlay.style.display = 'none';
        const scoreList = document.querySelector('.score-list-overlay');
        if (scoreList) scoreList.remove();
        document.body.style.overflow = 'auto';
        document.body.classList.remove('modal-open');
    }
});

document.getElementById('sortSelect').addEventListener('input', function(e) {
  const selectedValue = e.target.value;
  const options = Array.from(document.querySelectorAll('#sortOptions option')).map(o => o.value);
  
  if (options.includes(selectedValue)) {
    currentSort = selectedValue;
    renderCards(globalData);
    
    // We REMOVE the setTimeout clear from here
    e.target.blur(); // This deselects the box so the user can see the cards
  }
});

// When the user clicks or tabs into the search box
document.getElementById('sortSelect').addEventListener('focus', function(e) {
  // Clear the text so they can search fresh
  e.target.value = "";
});

// Optional: If they click away without picking anything, put the current sort back
document.getElementById('sortSelect').addEventListener('blur', function(e) {
  if (e.target.value === "") {
    e.target.value = currentSort;
  }
});
