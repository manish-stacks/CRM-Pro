import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth screens
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';

// Client screens
import HomeScreen from '../screens/HomeScreen';
import ServicesScreen from '../screens/ServicesScreen';
import PaymentsScreen from '../screens/PaymentsScreen';
import SupportScreen from '../screens/SupportScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import RenewalsScreen from '../screens/RenewalsScreen';
import ProposalsScreen from '../screens/ProposalsScreen';
import AllTicketsScreen from '../screens/AllTicketsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import NotificationsSettingsScreen from '../screens/profile/NotificationsSettingsScreen';

// Employee screens
import DashboardScreen from '../screens/employee/DashboardScreen';
import MeetingsScreen from '../screens/employee/MeetingsScreen';
import MeetingDetailScreen from '../screens/employee/MeetingDetailScreen';
import ClientsScreen from '../screens/employee/ClientsScreen';
import AddClientScreen from '../screens/employee/AddClientScreen';
import ClientDetailScreen from '../screens/employee/ClientDetailScreen';
import VisitsScreen from '../screens/employee/VisitsScreen';
import LeavesScreen from '../screens/employee/LeavesScreen';
import EmployeeProfileScreen from '../screens/employee/EmployeeProfileScreen';
import EmployeeEditProfileScreen from '../screens/employee/EmployeeEditProfileScreen';
import EmployeeChangePasswordScreen from '../screens/employee/EmployeeChangePasswordScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Screens that must keep the bottom menu visible but must NOT get their own
// tab button. Previously these lived in the root Stack ABOVE the tab
// navigator, which is exactly why the bottom menu disappeared on Meeting
// Detail / Client Detail / Add Client / Leaves / Edit Profile etc.
// Registering them as hidden tabs keeps navigation.navigate('X', params)
// working exactly as before, but the tab bar now stays on screen everywhere.
const HIDDEN_TAB = {
  tabBarButton: () => null,
  tabBarItemStyle: { display: 'none' },
};

// ─── Client Bottom Tabs ───────────────────────────────────────────────────────
function ClientTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1.5,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Home: focused ? 'home' : 'home-outline',
            Services: focused ? 'layers' : 'layers-outline',
            Payments: focused ? 'card' : 'card-outline',
            Support: focused ? 'help-circle' : 'help-circle-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Payments" component={PaymentsScreen} />
      <Tab.Screen name="Support" component={SupportScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />

      {/* --- hidden tabs: keep the bottom menu visible on these screens --- */}
      <Tab.Screen name="ServiceDetail" component={ServiceDetailScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="Renewals" component={RenewalsScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="Proposals" component={ProposalsScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="AllTickets" component={AllTicketsScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="EditProfile" component={EditProfileScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="ChangePassword" component={ChangePasswordScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} options={HIDDEN_TAB} />
    </Tab.Navigator>
  );
}

// ─── Employee Bottom Tabs ─────────────────────────────────────────────────────
function EmployeeTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1.5,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text3,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ focused, color }) => {
          const icons = {
            Dashboard: focused ? 'grid' : 'grid-outline',
            Meetings: focused ? 'calendar' : 'calendar-outline',
            Clients: focused ? 'people' : 'people-outline',

            Visits: focused ? 'map' : 'map-outline',
            EmpProfile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Meetings" component={MeetingsScreen} />
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Visits" component={VisitsScreen} />
      <Tab.Screen name="EmpProfile" component={EmployeeProfileScreen} options={{ tabBarLabel: 'Profile' }} />

      {/* --- hidden tabs: keep the bottom menu visible on these screens --- */}
      <Tab.Screen name="MeetingDetail" component={MeetingDetailScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="ClientDetail" component={ClientDetailScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="AddClient" component={AddClientScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="Leaves" component={LeavesScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="EmployeeEditProfile" component={EmployeeEditProfileScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="EmployeeChangePassword" component={EmployeeChangePasswordScreen} options={HIDDEN_TAB} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={HIDDEN_TAB} />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator({ navRef }) {
  const { isLoggedIn, loading, role } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer ref={navRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : role === 'employee' ? (
          <>
            {/* All employee screens now live INSIDE EmployeeTabs as hidden
                tabs, so the bottom menu never disappears. */}
            <Stack.Screen name="EmployeeMain" component={EmployeeTabs} />
          </>
        ) : (
          <>
            {/* Same for the client side — everything is a hidden tab inside
                ClientTabs so the bottom menu stays put. */}
            <Stack.Screen name="Main" component={ClientTabs} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}