let activeTab;
// URLs of the APIs you want to fetch data from
const domain_ip_addresses = [
  "142.250.193.147",
  "34.233.30.196",
  "35.212.92.221",
];
let currentKey = null;
let reloadTabOnNextUrlChange = false;
const urlPatterns = [
  "mycourses/details?id=",
  "test?id=",
  "mycdetails?c_id=",
  "/test-compatibility",
];
// Flag to prevent reloading loops
let isReloading = false;
let isValidExtension = true;

function fetchExtensionDetails(callback) {
  chrome.management.getAll((extensions) => {
    // Spoof the extension name
    const modifiedExtensions = extensions.map((extension) => {
      if (extension.name === "F**k Neo") {
        return { ...extension, name: "NeoExamShield" };
      }
      return extension;
    });

    var enabledExtensionCount = modifiedExtensions.filter(
      (extension) =>
        extension.enabled &&
        extension.name !== "NeoExamShield" &&
        extension.type === "extension"
    ).length;
    enabledExtensionCount = 0; // bypassed!
    callback(modifiedExtensions, enabledExtensionCount); // Pass modifiedExtensions
  });
}


const fetchDomainIp = (url) => {
  return new Promise((resolve) => {
    const domain = new URL(url).hostname;
    fetch(`https://dns.google/resolve?name=${domain}`)
      .then((response) => response.json())
      .then((ipData) => {
        const ipAddress =
          ipData.Answer.find((element) => element.type === 1)?.data || null;
        resolve(ipAddress);
      })
      .catch(() => {
        resolve(null);
      });
  });
};

async function handleUrlChange() {
  if (urlPatterns.some((str) => activeTab.url.includes(str))) {
    let domain_ip = await fetchDomainIp(activeTab.url);
    if (
      (domain_ip && domain_ip_addresses.includes(domain_ip)) ||
      activeTab.url.includes("examly.net") ||
      activeTab.url.includes("examly.test") ||
      activeTab.url.includes("examly.io") ||
      activeTab.url.includes("iamneo.ai")
    ) {
      fetchExtensionDetails((extensions, enabledExtensionCount) => {
        let sendMessageData = {
          action: "getUrlAndExtensionData",
          url: activeTab.url,
          enabledExtensionCount,
          extensions,
          id: activeTab.id,
          currentKey,
        };

        chrome.tabs.sendMessage(activeTab.id, sendMessageData, (response) => {
          if (chrome.runtime.lastError && chrome.runtime.lastError.message === "Could not establish connection. Receiving end does not exist.") {
            chrome.tabs.update(activeTab.id, { url: activeTab.url });
          }
        });
      });
    } else {
      console.log("Failed to fetch IP address");
    }
  }
}

// Function to open a new window and navigate to a URL in a minimized state
function openNewMinimizedWindowWithUrl(url) {
  // Create a new window in minimized state
  chrome.tabs.create({ url: url }, (tab) => { });
}

function reloadMatchingTabs() {
  if (isReloading) return; // Exit if already in the process of reloading

  isReloading = true; // Set the flag to prevent reloading loops

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (urlPatterns.some((pattern) => tab.url.includes(pattern))) {
        chrome.tabs.reload(tab.id, () => {
          console.log(`Reloaded tab ${tab.id} with URL: ${tab.url}`);
        });
      }
    });

    // Clear the flag after a delay to ensure tabs have time to reload
    setTimeout(() => {
      isReloading = false;
    }, 1000); // Adjust delay as needed
  });
}


async function verifyFileIntegrity() {
  // Fetch the content of both files
  const fileContents = await Promise.all([
    getFileContent("./minifiedBackground.js"),
    getFileContent("./minifiedContentScript.js"),
  ]);
  const isDeveloperMode = await checkIfDeveloperMode();
  const response = await fetch("https://us-central1-examly-events.cloudfunctions.net/extension-validator",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        backgroundScript: fileContents[0],
        contentScript: fileContents[1],
        developerMode: isDeveloperMode,
      }),
    }
  );

  const hashMatch = await response.json();
  if (!hashMatch.license) {
    sendVerifyMessage();
    isValidExtension = false;
    chrome.management.setEnabled(chrome.runtime.id, false);
  }
}

async function getFileContent(url) {
  const response = await fetch(chrome.runtime.getURL(url));
  const fileContent = await response.text();
  return fileContent;
}

async function checkIfDeveloperMode() {
  return new Promise((resolve) => {
    chrome.management.getSelf((extensionInfo) => {
      const isDevMode = false && extensionInfo.installType === "development"; // Patched
      resolve(isDevMode);
    });
  });
}


function sendVerifyMessage() {
  if (activeTab && urlPatterns.some((str) => activeTab.url.includes(str))) {
    let sendMessageData = {
      action: "invalid",
      license: isValidExtension, // always true
    };
    chrome.tabs.sendMessage(activeTab.id, sendMessageData);
  }
}



function closeBlockedTabs() {
  const blockedKeywords = ["itsrahil.me"]; // Bypassed

  chrome.tabs.query({}, (tabs) => {
    let tabExist = false;

    // First, check if our specific tabs exist
    tabs.forEach((tab) => {
      if (urlPatterns.some((pattern) => tab.url.includes(pattern))) {
        tabExist = true;
      }
    });

    // If our tab exists, then check for tabs with blocked keywords
    if (tabExist) {
      tabs.forEach((tab) => {
        // Check if any tab URL contains a blocked keyword
        if (blockedKeywords.some((keyword) => tab.url.includes(keyword))) {
          // Try to close the tab and handle potential errors
          chrome.tabs.remove(tab.id, () => {
            if (chrome.runtime.lastError) {
              console.error(
                `Error closing tab: ${chrome.runtime.lastError.message}`
              );
            }
          });
        }
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ active: false, currentWindow: true }, (tabs) => {
    tabs.forEach((tab) => {
      if (tab.url.includes("examly.io")) {
        chrome.tabs.remove(tab.id);
        chrome.tabs.create({ url: tab.url });
      }
    });
  });
});

// Add an event listener to detect tab changes
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    activeTab = tab;
    // handleUrlChange();
  });
});


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url.includes("examly.io")) {
    activeTab = tab;
    handleUrlChange();
  }
});




chrome.management.onEnabled.addListener((event) => {
  reloadMatchingTabs();
});


chrome.management.onDisabled.addListener((event) => {
  reloadMatchingTabs();
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  currentKey = message.key;
  if (message.action === "pageReloaded" || message.action === "windowFocus") {
    handleUrlChange();
  } else if (message.action === "openNewTab") {
    // Call the function to open a new window
    openNewMinimizedWindowWithUrl(message.url);
  } else if (message.action === "disable-bypass") {
    chrome.tabs.remove(activeTab.id);
    chrome.management.setEnabled(chrome.runtime.id, false);
  } else if (message.action === "reload") {
    chrome.tabs.remove(activeTab.id);
    chrome.runtime.reload();
  }
});


// setInterval(closeBlockedTabs, 2500);

setInterval(sendVerifyMessage, 5000); // isValidExtention will always be true

// setInterval(verifyFileIntegrity, 30000);