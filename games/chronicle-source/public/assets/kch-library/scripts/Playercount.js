
      (function() {
        let microwave_players = "";
        let foundmicowave = false;
        let observer = null;
        let intervalId = null;

        // Clean up previous elements and observers
        function cleanup() {
          if (document.getElementById('playerholderelement')) {
            document.getElementById('playerholderelement').remove();
          }
          if (observer) {
            observer.disconnect();
          }
          if (intervalId) {
            clearInterval(intervalId);
          }
        }

        async function playercountgetter(region) {
          let playercountnumber = 0;
          try {
            const response = await fetch(`https://${region}.kirka.io/matchmake/`, { cache: 'no-cache' });
            if (!response.ok) return 0;
            const playercountJSON = await response.json();

            if (!microwave_players) {
              playercountJSON.forEach((item) => {
                let found = 0;
                let temp_microwave = "";
                Object.keys(item).forEach((key) => {
                  if (typeof item[key] === "number" && item[key] < 9) {
                    found++;
                    temp_microwave = key;
                  }
                });
                if (found === 1 && temp_microwave) {
                  microwave_players = temp_microwave;
                  foundmicowave = true;
                }
              });
            }

            playercountJSON.forEach((element) => {
              playercountnumber += element[microwave_players] || 0;
            });
          } catch (err) {
            console.warn(`Error fetching player count for ${region}:`, err);
          }
          return playercountnumber;
        }

        async function createHTMLelement(text, number, id) {
          const playcountelement = document.createElement("div");
          playcountelement.id = id;
          playcountelement.className = id;
          playcountelement.innerHTML = `<div data-v-78c6e76c="" data-v-0ae66549="">${text}: ${number}</div>`;
          return playcountelement;
        }

        async function updatePlayerCount() {
          try {
            const regions = ['eu', 'na', 'asia'];
            const counts = await Promise.all(regions.map(region => playercountgetter(region)));
            const globalplayercount = counts.reduce((sum, num) => sum + Number(num), 0);

            const elements = await Promise.all([
              createHTMLelement("TOTAL", globalplayercount, "playcountelement"),
              createHTMLelement("EU", counts[0], "playcountelementeu"),
              createHTMLelement("NA", counts[1], "playcountelementna"),
              createHTMLelement("ASIA", counts[2], "playcountelementasia")
            ]);

            const currentlyplaying = document.createElement("div");
            currentlyplaying.id = "currentlyplaying";
            currentlyplaying.className = "currentlyplaying";
            currentlyplaying.innerHTML = '<div data-v-78c6e76c="" data-v-0ae66549="">CURRENTLY PLAYING:</div>';

            const playerholderelement = document.createElement("div");
            playerholderelement.id = "playerholderelement";
            playerholderelement.className = "playerholderelement";
            playerholderelement.style.display = "block";
            playerholderelement.style.position = "absolute";
            playerholderelement.style.bottom = "0";
            playerholderelement.style.zIndex = "11";
            playerholderelement.style.marginBottom = "1.4rem";

            playerholderelement.append(currentlyplaying, ...elements);

            const appendToInterface = () => {
              if (window.location.href === "https://kirka.io/" &&
                  document.getElementsByClassName("interface text-2")[0] &&
                  !document.getElementById("playerholderelement")) {
                document.getElementsByClassName("interface text-2")[0].appendChild(playerholderelement);
              }
            };

            appendToInterface();

            observer = new MutationObserver(appendToInterface);
            observer.observe(document, { subtree: true, childList: true });

            // Update every 30 seconds
            intervalId = setInterval(updatePlayerCount, 30000);
          } catch (err) {
            console.error('Error updating player count:', err);
          }
        }

        // Clean up any existing instances
        cleanup();
        // Start the player count
        updatePlayerCount();

        // Expose cleanup function for removal
        window.__obsidianPlayerCountCleanup = cleanup;
      })();
    