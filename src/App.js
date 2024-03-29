import React, { createContext, useEffect, useState, useRef } from "react";
import AudioPlayer from "./AudioPlayer";
import { getLyrics, listMusicFiles } from "./utilities/music";
import { Button, Table, Tabs, ConfigProvider, Layout, Menu, Typography, List } from "antd";
import { HistoryOutlined } from "@ant-design/icons";
import "./App.css";
import { PlayMode } from "./enum";
import { Lrc } from "lrc-kit";
import Icons from "./Components/Icons/Icons";
const { ipcRenderer } = window.require("electron");
export const AppConfig = createContext(undefined);
const Lyrics = ({ timestamp, lrc }) => {
    const containerRef = useRef(null);
    const [c, _c] = useState([]);
    const [lcl, _lcl] = useState([]);

    useEffect(() => {
        // Scroll to the middle of the container
        const i = c.findIndex((v) => v.timestamp >= timestamp);
        if (i !== -1) {
            document.querySelector(`.LyricsLine${i}`).scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [timestamp]);

    useEffect(() => {
        // Parse the LRC string
        const llrc = Lrc.parse(lrc);
        _c(llrc.lyrics);

        // // Find the line closest to the timestamp
        // const closestLineIndex = lrcObj.findIndexByTime(timestamp);

        // // Scroll to the closest line
        // if (containerRef.current && closestLineIndex !== -1) {
        //     const lineHeight = 20; // Adjust this value based on your styling
        //     containerRef.current.scrollTop = lineHeight * closestLineIndex - containerRef.current.clientHeight / 2;
        // }
    }, [lrc]);

    return (
        <div className="LyricsPlayer" ref={containerRef}>
            {c.map((line, index) => (
                <p className={`LyricsLine${index}`} key={index}>
                    {line.content}
                </p>
            ))}
        </div>
    );
};

function App() {
    const audioPlayerRef = useRef(null);
    const tableRef = useRef(null);
    const [musicList, setMusicList] = useState([]);
    const [songs, _songs] = useState([]);
    const [albums, _albums] = useState([]);
    const [currentPlaying, setCurrentPlaying] = useState();
    const [curp, _curp] = useState("");
    const [playMode, setPlayMode] = useState("random");
    const [playHistory, setPlayHistory] = useState([]);
    const [selectedAlbum, _selectedAlbum] = useState("_");
    const [selectedPlaylist, _selectedPlaylist] = useState("");
    const [showLyrics, _showLyrics] = useState(false);
    const [selectedArtist, _selectedArtist] = useState("_");
    const [selectedTab, _selectedTab] = useState("Playlists");
    const [menuData, _menuData] = useState({ playlists: [], albums: [], artists: [] });
    const [lrc, _lrc] = useState("");
    const [ts, _ts] = useState("");
    useEffect(() => {
        // Fetch and set the music list on startup
        listMusicFiles("D:\\Music")
            .then((musicList) => {
                console.log(musicList);
                _songs(musicList.songs);
                _albums(musicList.albums);
                _menuData({
                    playlists: [],
                    albums: [{ key: "_", album: "All Albums" }]
                        .concat(
                            (Object.values(musicList.albums) ?? []).sort((a, b) => {
                                const albumA = a.album || "";
                                const albumB = b.album || "";

                                if (albumA === "Unknown Album" && albumB !== "Unknown Album") {
                                    return -1; // "Unknown Album" comes first
                                } else if (albumA !== "Unknown Album" && albumB === "Unknown Album") {
                                    return 1; // "Unknown Album" comes first
                                } else {
                                    return albumA.localeCompare(albumB);
                                }
                            })
                        )
                        .map((v) => ({
                            key: v.key,
                            label: (
                                <Typography className="AlbumName">
                                    <div>{v.album}</div>
                                    <div>{v.albumartist}</div>
                                </Typography>
                            ),
                            icon: v.cover ? (
                                <img src={v.cover} alt="6" width={40} height={40} />
                            ) : v.key === "_" ? (
                                <Icons.Album />
                            ) : (
                                <Icons.Disc />
                            ),
                        })),
                    artists: [{ key: "_", label: "All Artists", icon: <Icons.Group /> }].concat(
                        musicList.artists
                            .sort((a, b) => a.localeCompare(b))
                            .map((v) => ({ key: v, label: v, icon: <Icons.User /> }))
                    ),
                });
            })
            .catch((error) => console.error("Error fetching music list:", error));
    }, []);

    const playMusic = (key) => {
        console.log(key);
        console.log(songs);
        // Update playHistory
        let song = songs.find((s) => s.key === key);
        if (key === curp) {
            audioPlayerRef.current.replay();
        } else {
            _curp(song.key);
            addToHistory(song);
            setCurrentPlaying(song.filePath);
        }
        getLyrics(song.filePath).then(_lrc);
    };

    const addToHistory = (song) => {
        setPlayHistory((ps) => {
            const updatedHistory = ps.filter((s) => s.key !== song.key);
            updatedHistory.push(song);
            return [...updatedHistory];
        });
    };

    const removeLastFromHistory = () => {
        setPlayHistory((ps) => {
            ps.pop();
            return [...ps];
        });
    };
    useEffect(() => {
        setPlayHistory((ph) => ph.filter((v) => musicList.some((m) => m.key === v.key)));
    }, [musicList]);

    useEffect(() => {
        console.log(playHistory);
    }, [playHistory]);

    const enableGetPrevious = () => playHistory.length > 1;

    const onPrevious = () => {
        const song = playHistory[playHistory.length - 2];
        removeLastFromHistory();
        playMusic(song.key);
    };

    const onPlayModeChange = () => {
        if (playMode === PlayMode.Loop) {
            setPlayMode(PlayMode.RepeatOne);
        } else if (playMode === PlayMode.RepeatOne) {
            setPlayMode(PlayMode.Random);
        } else {
            setPlayMode(PlayMode.Loop);
        }
    };

    const onNext = () => {
        switch (playMode) {
            case "one":
                playMusic(curp);
                break;
            case "random":
                let history;
                if (playHistory.length === musicList.length) {
                    history = playHistory.slice(Math.ceil(playHistory.length / 3));
                    setPlayHistory(history);
                } else {
                    history = playHistory;
                }

                let remainingSongs = musicList.filter((song) => history.findIndex((s) => s.key === song.key) === -1);
                if (remainingSongs.length === 0) {
                    playMusic(curp);
                } else {
                    const randomIndex = Math.floor(Math.random() * remainingSongs.length);
                    playMusic(remainingSongs[randomIndex].key);
                }
                break;
            case "loop":
                // For 'loop' mode, loop back to the first song when reaching the end
                playMusic(musicList[(musicList.findIndex((song) => song.key === curp) + 1) % musicList.length].key);
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        try {
            document
                .querySelector(".ant-menu.Songs > li.ant-menu-item-selected")
                .scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {}
    }, [curp]);
    const items = [
        {
            key: "Playlists",
            label: "Playlists",
        },
        {
            key: "Albums",
            label: "Ablums",
        },
        {
            key: "Artists",
            label: "Artists",
        },
    ];

    const filterMusicList = (action, key) => {
        setMusicList([]);
        switch (action) {
            case "Playlists":
                break;
            case "Albums":
                if (key === "_") {
                    setMusicList(songs);
                } else {
                    setMusicList(songs.filter((v) => v.album === key));
                }
                break;
            case "Artists":
                if (key === "_") {
                    setMusicList(songs);
                } else {
                    setMusicList(songs.filter((v) => v.artist.includes(key)));
                }
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        switch (selectedTab) {
            case "Playlists":
                break;
            case "Albums":
                filterMusicList(selectedTab, selectedAlbum);
                break;
            case "Artists":
                filterMusicList(selectedTab, selectedArtist);
                break;

            default:
                break;
        }
    }, [selectedTab, selectedAlbum, selectedArtist]);

    return (
        <AppConfig.Provider value={{ playMusic }}>
            <ConfigProvider
                theme={{
                    components: {
                        Layout: {
                            headerBg: "#fff",
                            bodyBg: "#fff",
                            footerBg: "#fff",
                        },
                        Button: {
                            colorText: "#666666",
                        },
                        Tooltip: {
                            fontSize: 12,
                        },
                        Message: {
                            colorError: "red",
                        },
                    },
                    token: {
                        fontFamily: `ChillRoundGothic, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`,
                    },
                }}
            >
                <div className="App">
                    <div className="Header">
                        <Tabs
                            items={items}
                            tabBarStyle={{ height: 50, padding: "0 20px" }}
                            onChange={_selectedTab}
                            activeKey={selectedTab}
                        />
                        <Button.Group>
                            <Button
                                icon={<Icons.Settings />}
                                type="text"
                                onClick={() => ipcRenderer.send("minimize")}
                            />

                            <Button
                                icon={<Icons.PicInPic />}
                                type="text"
                                onClick={() => ipcRenderer.send("minimize")}
                            />
                            <Button
                                icon={<Icons.Subtract />}
                                type="text"
                                onClick={() => ipcRenderer.send("minimize")}
                            />
                            <Button
                                icon={<Icons.Close />}
                                type="text"
                                danger
                                onClick={() => ipcRenderer.send("close")}
                            />
                        </Button.Group>
                    </div>
                    <div className={`Content ${showLyrics ? "ShowLyrics" : ""}`}>
                        <Menu
                            className="Menu Playlist"
                            mode="inline"
                            defaultSelectedKeys={["_"]}
                            // onSelect={menuAction.Playlists}
                            items={menuData.playlists}
                            style={{ display: selectedTab === "Playlists" ? undefined : "none" }}
                        />
                        <Menu
                            className="Menu Album"
                            mode="inline"
                            selectedKeys={[selectedAlbum]}
                            onSelect={(i) => _selectedAlbum(i.key)}
                            items={menuData.albums}
                            style={{ display: selectedTab === "Albums" ? undefined : "none" }}
                        />
                        <Menu
                            className="Menu Artist"
                            mode="inline"
                            selectedKeys={[selectedArtist]}
                            onSelect={(i) => _selectedArtist(i.key)}
                            items={menuData.artists}
                            style={{ display: selectedTab === "Artists" ? undefined : "none" }}
                        />
                        <Menu
                            className="Songs"
                            mode="inline"
                            selectedKeys={[curp]}
                            onSelect={(i) => playMusic(i.key)}
                            items={musicList
                                .sort((a, b) => a.title.localeCompare(b.title))
                                .map((v) => ({
                                    key: v.key,
                                    label: (
                                        <Typography className="AlbumName">
                                            <div>{v.title}</div>
                                            <div>{v.artist}</div>
                                        </Typography>
                                    ),
                                }))}
                        />
                        <div className="Lyrics">
                            <Lyrics timestamp={0} lrc={lrc} />
                        </div>
                    </div>
                    <div className="Footer">
                        <AudioPlayer
                            ref={audioPlayerRef}
                            src={currentPlaying}
                            onNext={onNext}
                            onPrevious={onPrevious}
                            enableOnNext
                            enableOnPrevious={enableGetPrevious()}
                            playMode={playMode}
                            onPlayModeChange={onPlayModeChange}
                            showLyrics={_showLyrics}
                        />
                        {/* <div>
                            <label>Play Mode:</label>
                            <select value={playMode} onChange={(e) => handlePlayModeChange(e.target.value)}>
                                <option value="one">Repeat One</option>
                                <option value="random">Random</option>
                                <option value="loop">Loop</option>
                            </select>
                            <div>
                                <Button disabled={!enableGetPrevious()} onClick={onPrevious}>
                                    Previous
                                </Button>
                                <button onClick={onNext}>Next</button>
                            </div>
                        </div> */}
                    </div>
                </div>
            </ConfigProvider>
        </AppConfig.Provider>
    );
}

export default App;
