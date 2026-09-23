import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'providers/project_provider.dart';
import 'services/auth_service.dart';
import 'screens/canvas_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/login_screen.dart';
import 'screens/voice_assistant_screen.dart';
import 'widgets/interactive_tour_overlay.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CaseUmlMobileApp());
}

class CaseUmlMobileApp extends StatelessWidget {
  const CaseUmlMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()..init()),
        ChangeNotifierProvider(create: (_) => ProjectProvider()),
      ],
      child: MaterialApp(
        title: 'CASE Studio UML Mobile',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          scaffoldBackgroundColor: const Color(0xFF070B14),
          primaryColor: const Color(0xFF7C3AED),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFF7C3AED),
            secondary: Color(0xFF2DD4BF),
            surface: Color(0xFF0F172A),
          ),
          fontFamily: 'Roboto',
        ),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    if (auth.currentUser == null) {
      return const LoginScreen();
    }
    return const MainNavigationScreen();
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  int _dashboardSubTab = 0;
  int _voiceChannel = 0;
  bool _isTourActive = false;

  @override
  void initState() {
    super.initState();
    _checkFirstTimeTour();
  }

  Future<void> _checkFirstTimeTour() async {
    final user = AuthService().currentUser;
    if (user != null) {
      try {
        final prefs = await SharedPreferences.getInstance();
        final key = 'case_tour_shown_${user.id}';
        final shown = prefs.getBool(key) ?? false;
        if (!shown) {
          await prefs.setBool(key, true);
          if (mounted) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              _startTour();
            });
          }
        }
      } catch (_) {}
    }
  }

  void _navigateToTab(int index) {
    setState(() => _currentIndex = index);
  }

  void _startTour() {
    setState(() {
      _isTourActive = true;
      _currentIndex = 0;
      _dashboardSubTab = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      DashboardScreen(
        initialSubTab: _dashboardSubTab,
        onStartTour: _startTour,
        onOpenCanvas: () => _navigateToTab(2),
        onOpenVoiceAssistant: () => _navigateToTab(1),
      ),
      VoiceAssistantScreen(
        initialVoiceChannel: _voiceChannel,
        onNavigateToCanvas: () => _navigateToTab(2),
      ),
      CanvasScreen(
        onStartTour: _startTour,
      ),
    ];

    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: screens,
          ),
          if (_isTourActive)
            InteractiveTourCard(
              onStepChanged: (tabIndex, subTabIndex, voiceChannel) {
                setState(() {
                  _currentIndex = tabIndex;
                  if (subTabIndex != null) _dashboardSubTab = subTabIndex;
                  if (voiceChannel != null) _voiceChannel = voiceChannel;
                });
              },
              onDismiss: () {
                setState(() => _isTourActive = false);
              },
            ),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0B0F19),
          border: Border(top: BorderSide(color: Color(0xFF1E293B), width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: _navigateToTab,
          backgroundColor: Colors.transparent,
          elevation: 0,
          selectedItemColor: const Color(0xFFA855F7),
          unselectedItemColor: const Color(0xFF64748B),
          selectedFontSize: 11,
          unselectedFontSize: 10,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.dashboard_outlined),
              activeIcon: Icon(Icons.dashboard),
              label: 'Dashboard',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.mic_outlined),
              activeIcon: Icon(Icons.mic),
              label: 'Voz (Sin GUI)',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.schema_outlined),
              activeIcon: Icon(Icons.schema),
              label: 'Lienzo UML',
            ),
          ],
        ),
      ),
    );
  }
}
