const BASE_URL = "https://generativelanguage.googleapis.com";

// Global variables to store state
let uploadUrl = null;
let fileUri = null;
let fileId = null;
let fileState = null;
let apiKeys = [];
let apiKeyIndex = 0;
let isDarkMode = localStorage.getItem("theme") === "dark" ? true : false;
let videoFileName = null; // To store video file name for download
const body = document.body;
const themeButton = document.getElementById('themeToggle');
const aiDurationWarningElement = document.getElementById('aiDurationWarning'); // Get the warning element
const durationInputSectionElement = document.getElementById('durationInputSection'); // Get duration input section
const downloadOutputButton = document.getElementById('downloadOutputButton'); // Download button
const estimatedTimeElement = document.getElementById('estimatedTime'); // Estimated time section
const estimatedTimeValueElement = document.getElementById('estimatedTimeValue'); // Estimated time value span

        // Pre-ready prompts
        const PRESET_PROMPTS = {
            "generate-subtitles": `Generate subtitles for the provided video in the .srt file style, covering the time range [START_TIME] to [END_TIME].\nMatch the subtitle language to the video’s audio language.\nTranscribe all audible spoken content within this range, ensuring no parts are skipped.\nDivide the subtitles into concise, readable segments, each appearing on screen for 2-4 seconds.\n\nFormat each subtitle block as follows:\n[Subtitle index number]\n[Start time in HH:MM:SS,MMM format] --> [End time in HH:MM:SS,MMM format]\n[Text of the subtitle]\n\nSynchronize subtitles with the audio, ensuring accuracy and readability.\nReflect the spoken content precisely, using proper punctuation and capitalization.\nFor multiple speakers, label them clearly (e.g., [Speaker 1]: [Dialogue]).\nLimit each subtitle block to two lines, with a maximum of 80 characters per line, including spaces and punctuation.\nSeparate each subtitle block with exactly one blank line.\n**Return *only* the subtitle content in .srt format, without any introductory or concluding remarks.**`,
            "summarize-video": "Provide a concise summary of this video.",
            "describe-scenes": "Describe the key scenes in this video with timestamps.",
            "extract-key-events": "Extract and list the key events in this video with timestamps.",
            "get-duration": "What is the total duration of this video? Provide the answer in a format like 'The video is X minutes and Y seconds long.'"
        };

        // Log messages to the UI
        function log(message) {
            const logDiv = document.getElementById("log");
            logDiv.innerHTML += `<p>${new Date().toLocaleTimeString()}: ${message}</p>`;
            logDiv.scrollTop = logDiv.scrollHeight;
        }

        // Display generated content with Markdown
        function displayOutput(content) {
            const outputDiv = document.getElementById("output");
            outputDiv.innerHTML = marked.parse(content);
        }

        // Theme toggle
        function toggleTheme() {
            isDarkMode = !isDarkMode;
            body.classList.toggle('dark-theme');
            if (isDarkMode) {
                themeButton.innerHTML = '<i class="icon">☀️</i> Light Mode';
                localStorage.setItem("theme", "dark"); // Corrected: set "dark" for dark mode
            } else {
                themeButton.innerHTML = '<i class="icon">🌙</i> Dark Mode';
                localStorage.setItem("theme", "light"); // Corrected: set "light" for light mode
            }
        }

        // Load saved theme and API Keys
        window.onload = () => {
            const savedTheme = localStorage.getItem("theme");
            if (savedTheme === "dark") {
                document.body.classList.remove("light-theme");
                document.body.classList.add("dark-theme");
                themeButton.innerHTML = '<i class="icon">☀️</i> Light Mode';
            } else {
                document.body.classList.add("light-theme");
                themeButton.innerHTML = '<i class="icon">🌙</i> Dark Mode';
            }
            setInputMode('file'); // Ensure initial state is file input
            togglePromptSelect(); // Set initial visibility of duration input and download button based on prompt
            loadSavedApiKeys(); // Load API keys from localStorage
        };

        // Load API Keys from LocalStorage
        function loadSavedApiKeys() {
            const savedKeys = JSON.parse(localStorage.getItem('savedApiKeys')) || [];
            if (savedKeys.length > 0) {
                document.getElementById('apiKey').value = savedKeys[0] || '';
                const extraKeysDiv = document.getElementById('extraApiKeys');
                for (let i = 1; i < savedKeys.length; i++) {
                    addApiKeyField(); // Add extra key field
                    const extraKeyInput = extraKeysDiv.lastElementChild.querySelector('.input-field');
                    if (extraKeyInput) {
                        extraKeyInput.value = savedKeys[i];
                    }
                }
            }
        }

        // Save API Keys to LocalStorage
        function saveApiKeysToLocalStorage() {
            const mainApiKey = document.getElementById('apiKey').value.trim();
            const extraApiKeysElements = document.querySelectorAll('.extra-api-key');
            const extraApiKeys = Array.from(extraApiKeysElements).map(input => input.value.trim());
            const allKeys = [mainApiKey, ...extraApiKeys].filter(key => key);
            localStorage.setItem('savedApiKeys', JSON.stringify(allKeys));
        }


        // Toggle custom prompt visibility and duration input section
        function togglePromptSelect() {
            const promptSelect = document.getElementById('promptSelect');
            const customPromptSection = document.getElementById('customPromptSection');
            if (promptSelect.value === 'custom') {
                customPromptSection.style.display = 'block';
            } else {
                customPromptSection.style.display = 'none';
            }

            // Show duration input and download button only for "generate-subtitles"
            if (promptSelect.value === 'generate-subtitles') {
                durationInputSectionElement.style.display = 'block';
                downloadOutputButton.style.display = 'inline-block'; // Show download button
            } else {
                durationInputSectionElement.style.display = 'none';
                downloadOutputButton.style.display = 'none'; // Hide download button
            }
        }

        // Toggle between file input and URL input
        function setInputMode(mode) {
            const fileSection = document.getElementById('fileInputSection');
            const urlSection = document.getElementById('urlInputSection');
            const fileButtons = document.querySelectorAll('.mode-button[data-mode="file"]');
            const urlButtons = document.querySelectorAll('.mode-button[data-mode="url"]');

            if (mode === 'file') {
                fileSection.style.display = 'block';
                urlSection.style.display = 'none';
                fileButtons.forEach(button => button.classList.add('active'));
                urlButtons.forEach(button => button.classList.remove('active'));
            } else if (mode === 'url') {
                fileSection.style.display = 'none';
                urlSection.style.display = 'block';
                urlButtons.forEach(button => button.classList.add('active'));
                fileButtons.forEach(button => button.classList.remove('active'));
            }
        }

        // Toggle manual duration input visibility
        function toggleManualDurationInput() {
            const manualDurationFields = document.getElementById('manualDurationFields');
            manualDurationFields.style.display = document.getElementById('manualDurationCheckbox').checked ? 'block' : 'none';
            aiDurationWarningElement.style.display = document.getElementById('manualDurationCheckbox').checked ? 'none' : 'block'; // Show warning when manual duration is OFF
        }


        // Add a new API key field
        let apiKeyCount = 1;
        function addApiKeyField() {
            saveApiKeysToLocalStorage(); // Save current keys before adding new field
            apiKeyCount++;
            const extraApiKeysDiv = document.getElementById('extraApiKeys');
            const apiKeyDiv = document.createElement('div');
            apiKeyDiv.classList.add('api-key-group');
            apiKeyDiv.innerHTML = `
                <label for="apiKey${apiKeyCount}" class="input-label">API Key ${apiKeyCount}</label>
                <div class="api-key-input-wrapper">
                    <input type="text" id="apiKey${apiKeyCount}" class="input-field extra-api-key" placeholder="Enter your Gemini API Key">
                    <button class="api-key-button remove-api-key" onclick="removeApiKeyField(this.parentNode.parentNode)">-</button>
                </div>
            `;
            extraApiKeysDiv.appendChild(apiKeyDiv);
        }

        function removeApiKeyField(apiKeyGroup) {
            apiKeyGroup.remove();
            saveApiKeysToLocalStorage(); // Save keys after removing a field
        }

        // Get the next API key (cycle through available keys)
        function getNextApiKey() {
            const mainApiKey = document.getElementById("apiKey").value.trim();
            const extraApiKeysElements = document.querySelectorAll(".extra-api-key");
            const extraApiKeys = Array.from(extraApiKeysElements).map(input => input.value.trim());
            apiKeys = [mainApiKey, ...extraApiKeys].filter(key => key); // Filter out empty keys
            if (apiKeys.length === 0) return null;
            const key = apiKeys[apiKeyIndex];
            apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length; // Cycle through keys
            log(`Using API Key: ${key.slice(0, 5)}...`);
            return key;
        }

        // Save video details to localStorage (for file uploads only)
        function saveVideoDetails(fileName, mimeType) {
            const videoDetails = {
                fileUri: fileUri,
                fileId: fileId,
                mimeType: mimeType,
                fileName: fileName,
                timestamp: Date.now()
            };
            localStorage.setItem(`video_${fileName}`, JSON.stringify(videoDetails));
            log(`Saved video details for ${fileName} in local storage.`);
        }

        // Load video details from localStorage (for file uploads only)
        function loadVideoDetails(fileName) {
            const details = localStorage.getItem(`video_${fileName}`);
            if (details) {
                const parsed = JSON.parse(details);
                const savedTimestamp = parsed.timestamp;
                const now = Date.now();
                const fortyEightHoursMs = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

                if (now - savedTimestamp > fortyEightHoursMs) {
                    log(`Saved video details for ${fileName} are older than 48 hours. Removing and re-uploading.`);
                    localStorage.removeItem(`video_${fileName}`); // Remove expired details
                    return null; // Indicate details are expired and should not be used
                }

                fileUri = parsed.fileUri;
                fileId = parsed.fileId;
                fileState = "ACTIVE";
                return parsed; // Return valid, non-expired details
            }
            return null; // No details found in local storage
        }

        // Step 1: Initiate resumable upload and get upload URL (for files)
        async function startUpload(apiKey, videoFile) {
            const mimeType = videoFile.type;
            const numBytes = videoFile.size;
            const displayName = videoFile.name;

            const metadata = { file: { display_name: displayName } };

            log("Initiating upload...");
            const response = await fetch(`${BASE_URL}/upload/v1beta/files?key=${apiKey}`, {
                method: "POST",
                headers: {
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": numBytes,
                    "X-Goog-Upload-Header-Content-Type": mimeType,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(metadata)
            });

            if (!response.ok) throw new Error("Upload initiation failed");
            uploadUrl = response.headers.get("X-Goog-Upload-URL");
            log("Upload URL acquired.");
            return uploadUrl;
        }

        // Step 2: Upload the video file (for files)
        async function uploadVideo(videoFile) {
            log("Uploading video...");
            const response = await fetch(uploadUrl, {
                method: "POST",
                headers: {
                    "Content-Length": videoFile.size,
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize"
                },
                body: videoFile
            });

            if (!response.ok) throw new Error("Video upload failed");
            const data = await response.json();
            fileUri = data.file.uri;
            fileState = data.file.state;
            fileId = fileUri.split("/").pop();
            log(`Video uploaded. State: ${fileState}`);
            return fileState;
        }

        // Step 3: Check the processing state (for files)
        async function checkState(apiKey) {
            log("Checking file state...");
            const response = await fetch(`${BASE_URL}/v1beta/files/${fileId}?key=${apiKey}`, {
                method: "GET"
            });

            if (!response.ok) throw new Error("State check failed");
            const data = await response.json();
            fileState = data.state;
            log(`Current state: ${fileState}`);
            return fileState;
        }

        // Convert seconds to HH:MM:SS,MS format
        function secondsToTime(seconds) {
            const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
            const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
            const s = Math.floor(seconds % 60).toString().padStart(2, "0");
            const ms = "000";
            return `${h}:${m}:${s},${ms}`;
        }

        // Convert HH:MM:SS to seconds
        function timeToSeconds(timeStr) {
            if (!timeStr) return null;
            const parts = timeStr.split(':');
            if (parts.length !== 3) return null;
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseInt(parts[2]);

            if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) ||
                hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
                return null; // Invalid time format
            }
            return hours * 3600 + minutes * 60 + seconds;
        }


        // Parse duration from API response (e.g., "The video is 25 minutes and 30 seconds long.")
        function parseDuration(response) {
            const match = response.match(/The video is (\d+) minutes?(?: and (\d+) seconds)? long\./i);
            if (!match) throw new Error("Could not parse video duration from response.");
            const minutes = parseInt(match[1]) || 0;
            const seconds = parseInt(match[2]) || 0;
            return minutes * 60 + seconds;
        }

        // Step 4: Generate content from the video - with retry logic
        async function generateContent(apiKey, model, prompt, mimeType, videoUri, startTime = "00:00:00,000", endTime = null, maxRetries = 3) {
            let retries = 0;
            let lastError = null;

            while (retries <= maxRetries) {
                const requestBody = {
                    contents: [{
                        parts: [
                            { text: prompt.replace("[START_TIME]", startTime).replace("[END_TIME]", endTime || "end of video") },
                            { file_data: { mime_type: mimeType || "video/mp4", file_uri: videoUri } }
                        ]
                    }]
                };

                log(`Generating content from ${startTime} to ${endTime || "end"}... (Attempt ${retries + 1})`);
                try {
                    const response = await fetch(`${BASE_URL}/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.candidates[0].content.parts[0].text; // Successful response
                    } else {
                        lastError = new Error(`Content generation failed with status ${response.status}`);
                        log(`Attempt ${retries + 1} failed: ${lastError.message}`);
                    }
                } catch (error) {
                    lastError = error;
                    log(`Attempt ${retries + 1} failed with an exception: ${error.message}`);
                }
                retries++;
                if (retries <= maxRetries) {
                    log(`Waiting 60 seconds before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds before retry
                }
            }

            log(`All ${maxRetries + 1} attempts to generate content failed.`);
            throw lastError || new Error("Content generation failed after multiple retries."); // Throw the last error or a generic error
        }


        // Get video duration - now with manual override and warning
        async function getVideoDuration(apiKey, model, mimeType, videoUri) {
            const manualDurationStr = document.getElementById('manualDuration').value.trim();
            const manualDurationSeconds = timeToSeconds(manualDurationStr);

            if (manualDurationSeconds !== null && document.getElementById('manualDurationCheckbox').checked) {
                log(`Using manual video duration: ${manualDurationStr}`);
                document.getElementById('aiDetectedDurationSection').style.display = 'none'; // Hide AI duration info
                return manualDurationSeconds;
            } else {
                const durationPrompt = PRESET_PROMPTS["get-duration"];
                let durationSeconds;
                try {
                    const response = await generateContent(apiKey, model, durationPrompt, mimeType, videoUri); // Corrected prompt here
                    durationSeconds = parseDuration(response);
                    const durationMinutes = Math.floor(durationSeconds / 60);
                    const remainingSeconds = durationSeconds % 60;
                    const durationText = `${durationMinutes} minutes and ${remainingSeconds} seconds`;
                    document.getElementById('aiDetectedDuration').textContent = `AI detected duration: ${durationText}`;
                    document.getElementById('aiDetectedDurationSection').style.display = 'block';
                    aiDurationWarningElement.style.display = 'block'; // Ensure warning is visible when using AI detection
                    log(`AI detected video duration: ${durationText}`);
                } catch (error) {
                    log(`Error during AI duration detection: ${error.message}`);
                    document.getElementById('aiDetectedDuration').textContent = `AI duration detection failed.`;
                    document.getElementById('aiDetectedDurationSection').style.display = 'block';
                    aiDurationWarningElement.style.display = 'block'; // Ensure warning is visible even on AI failure
                    return null; // Indicate failure to get duration
                }
                return durationSeconds;
            }
        }


        // Process subtitles in parts with user-defined part duration in minutes (min 1) - with retry logic
        async function processSubtitlesInParts(model, prompt, mimeType, videoUri, maxRetries = 3) {
            let retries = 0;
            let lastError = null;

            while (retries <= maxRetries) {
                try {
                    let partDurationMinutes = parseInt(document.getElementById('partDuration').value, 10);

                    if (isNaN(partDurationMinutes) || partDurationMinutes < 1) {
                        log("Invalid part duration. Using default 7 minutes. Minimum is 1 minute.");
                        partDurationMinutes = 7; // Default to 7 minutes if invalid, minimum 1 min
                    }

                    const apiKey = getNextApiKey();
                    if (!apiKey) throw new Error("No valid API keys provided.");

                    let durationSeconds = await getVideoDuration(apiKey, model, mimeType, videoUri); // Get duration first
                    if (durationSeconds === null) { // If duration is not obtained, stop processing
                        throw new Error("Video duration could not be determined. Subtitle generation aborted.");
                    }


                    const partDurationSeconds = partDurationMinutes * 60; // Convert minutes to seconds
                    let estimatedResponseTimePerPart = 60; // Default, will be updated after first part
                    let numberOfParts = Math.ceil(durationSeconds / partDurationSeconds);
                    let firstPartContent = ""; // Declare firstPartContent here, initialize to empty string


                    estimatedTimeElement.style.display = 'block';


                    let fullContent = "";
                    let indexOffset = 0;
                    let firstPartTime = 0; // To store the time taken for the first part

                    // Process the first part to estimate time
                    const startTimeFirstPart = secondsToTime(0);
                    const endTimeFirstPart = secondsToTime(Math.min(partDurationSeconds, durationSeconds));
                    log(`Processing first subtitle part to estimate time: ${startTimeFirstPart} to ${endTimeFirstPart}`);

                    const startFirstPart = performance.now(); // Start time for first part
                    try {
                        firstPartContent = await generateContent(apiKey, model, prompt, mimeType, videoUri, startTimeFirstPart, endTimeFirstPart); // Assign value to firstPartContent
                        firstPartTime = (performance.now() - startFirstPart) / 1000; // Time in seconds
                        estimatedResponseTimePerPart = Math.max(firstPartTime, 30); // Use first part time, but minimum 30 seconds to avoid very low estimates
                        log(`First part processing time: ${firstPartTime.toFixed(1)} seconds. Using ${estimatedResponseTimePerPart.toFixed(1)}s per part for estimate.`);
                    } catch (error) {
                        log(`Error during first part processing for time estimation: ${error.message}. Using default estimate.`);
                        // Fallback to default if first part fails to process for time estimation
                        estimatedResponseTimePerPart = 60; // Default estimate if first part fails for time estimation
                        firstPartContent = ""; // Ensure firstPartContent is empty string in case of error
                    }


                    let estimatedTotalSeconds = numberOfParts * estimatedResponseTimePerPart;
                    let estimatedMinutes = Math.ceil(estimatedTotalSeconds / 60);
                    estimatedTimeValueElement.textContent = `${estimatedMinutes} minutes (approx.)`;


                    for (let start = 0; start < durationSeconds; start += partDurationSeconds) {
                        // ADDED LOGGING HERE:
                        log(`Loop start: start=${start}, firstPartTime=${firstPartTime}`);

                        const startTime = secondsToTime(start);
                        const endTime = secondsToTime(Math.min(start + partDurationSeconds, durationSeconds));
                        const partApiKey = getNextApiKey();
                        if (!partApiKey) throw new Error("No valid API keys provided.");

                        // Skip the first part as it was already processed for time estimation
                        if (start === 0 && firstPartTime > 0) {
                            indexOffset = (firstPartContent.split("\n").filter(line => /^\d+$/.test(line)).pop() || 0) ; // Try to get last index from first part content, default to 0 if none found
                            if (indexOffset) indexOffset = parseInt(indexOffset); else indexOffset = 0; // Ensure indexOffset is a number

                            if (start >= durationSeconds) break; // Check if done
                            log("Skipped processing for part: 00:00:00,000 because it was used for estimation."); // Added log for skip

                            fullContent += firstPartContent + "\n\n"; // **APPEND firstPartContent HERE**


                        } else { // ADDED else block to process parts when not skipped
                            log(`Processing subtitles for part: ${startTime} to ${endTime}`);
                            let partContent = await generateContent(partApiKey, model, prompt, mimeType, videoUri, startTime, endTime);

                            // Adjust subtitle indices to be continuous
                            const lines = partContent.split("\n");
                            let adjustedContent = "";
                            let currentIndex = null;
                            for (const line of lines) {
                                if (/^\d+$/.test(line.trim())) {
                                    currentIndex = parseInt(line) + indexOffset;
                                    adjustedContent += `${currentIndex}\n`;
                                } else {
                                    adjustedContent += `${line}\n`;
                                }
                            }
                            fullContent += adjustedContent + "\n";
                            indexOffset = currentIndex || indexOffset; // Update offset based on last index
                        }
                    }

                    estimatedTimeElement.style.display = 'none'; // Hide estimated time after processing
                    return fullContent.trim(); // Return successful content and exit retry loop
                } catch (error) {
                    lastError = error;
                    log(`processSubtitlesInParts failed. Attempt ${retries + 1} error: ${error.message}`);
                    retries++;
                    if (retries <= maxRetries) {
                        log(`Waiting 60 seconds before retrying processSubtitlesInParts...`);
                        await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 60 seconds before retry
                    } else {
                        log(`All ${maxRetries + 1} attempts to process subtitles parts failed.`);
                        throw lastError; // Re-throw the last error to be caught by processVideo
                    }
                }
            }
             throw lastError || new Error("processSubtitlesInParts failed after multiple retries."); // Should not reach here, but for safety
        }

        // Copy output to clipboard
        function copyOutputToClipboard() {
            const outputText = document.getElementById('output').innerText;
            navigator.clipboard.writeText(outputText).then(() => {
                log('Output copied to clipboard!'); // Provide user feedback in log
            }).catch(err => {
                console.error('Could not copy text: ', err);
                log('Failed to copy output to clipboard.'); // User feedback for failure
            });
        }

        // Download output as SRT file
        function downloadOutputAsSRT() {
            const outputText = document.getElementById('output').innerText;
            const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = videoFileName ? videoFileName.replace(/\.[^/.]+$/, "") + '.srt' : 'subtitles.srt'; // Use video file name or default
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
            log('Subtitles downloaded as SRT file.');
        }


        // Process the video
        async function processVideo() {
            const fileInputSection = document.getElementById('fileInputSection').style.display === 'block';
            const videoFile = document.getElementById("videoInput").files[0];
            const videoUrl = document.getElementById("videoUrl").value.trim();
            const model = document.getElementById("modelSelect").value;
            const promptSelect = document.getElementById("promptSelect").value;
            const customPrompt = document.getElementById("customPrompt").value.trim();
            const prompt = promptSelect === "custom" ? (customPrompt || "Describe this video clip") : PRESET_PROMPTS[promptSelect];
            videoFileName = videoFile ? videoFile.name : null; // Store video file name for download

            const apiKey = getNextApiKey();
            if (!apiKey) {
                log("Please enter at least one API key.");
                return;
            }

            try {
                if (!fileInputSection) { // URL input is selected
                    if (!videoUrl) {
                        log("Please enter a video URL.");
                        return;
                    }
                    log(`Processing video from URL: ${videoUrl}`);
                    fileUri = videoUrl;
                    videoFileName = 'video_from_url'; // Default name for URL input
                    let content;
                    if (promptSelect === "generate-subtitles") {
                        content = await processSubtitlesInParts(model, prompt, null, videoUrl);
                    } else {
                        content = await generateContent(apiKey, model, prompt, null, videoUrl);
                    }
                    log("Content generated successfully.");
                    displayOutput(content);
                } else { // File input is selected
                    if (!videoFile) {
                        log("Please select a video file.");
                        return;
                    }

                    const fileName = videoFile.name;
                    const mimeType = videoFile.type;
                    videoFileName = fileName;

                    // Check if video details are already in localStorage
                    const savedDetails = loadVideoDetails(fileName);
                    if (savedDetails && savedDetails.mimeType === mimeType) {
                        log(`Video ${fileName} found in local storage. Skipping upload.`);
                        let content;
                        if (promptSelect === "generate-subtitles") {
                            content = await processSubtitlesInParts(model, prompt, savedDetails.mimeType, savedDetails.fileUri);
                        } else {
                            content = await generateContent(apiKey, model, prompt, savedDetails.mimeType, savedDetails.fileUri);
                        }
                        log("Content generated successfully.");
                        displayOutput(content);
                        return;
                    }

                    // Step 1: Start upload
                    await startUpload(apiKey, videoFile);
                    if (!uploadUrl) throw new Error("No upload URL received.");

                    // Step 2: Upload video
                    await uploadVideo(videoFile);

                    // Step 3: Check state until ACTIVE
                    let attempts = 0;
                    const maxAttempts = 30; // 5-minute timeout
                    while (fileState !== "ACTIVE" && attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s
                        await checkState(apiKey);
                        attempts++;
                    }
                    if (fileState !== "ACTIVE") throw new Error("Processing timed out.");

                    // Save details to localStorage after reaching ACTIVE state
                    saveVideoDetails(fileName, mimeType);

                    // Step 4: Generate content
                    log("Processing complete. Ready for analysis.");
                    let content;
                    if (promptSelect === "generate-subtitles") {
                        content = await processSubtitlesInParts(model, prompt, mimeType, fileUri);
                    } else {
                        content = await generateContent(apiKey, model, prompt, mimeType, fileUri);
                    }
                    log("Content generated successfully.");
                    displayOutput(content);
                }
            } catch (error) {
                log(`Error: ${error.message}`);
            }
                function copyWalletAddress() {
    const walletAddress = 'UQBNM8_syproehAkD4Yc3sLZYmw0XWsliWRgIPwlym4LlyoE';
    navigator.clipboard.writeText(walletAddress).then(() => {
        alert('Wallet address copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy address:', err);
    });
}
        }
